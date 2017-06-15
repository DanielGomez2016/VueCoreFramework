﻿import Vue from 'vue';
import VueRouter from 'vue-router';
import { Component, Prop, Watch } from 'vue-property-decorator';
import * as ErrorMsg from '../../error-msg';
import { FieldDefinition, Schema, VFGOptions } from '../../vfg/vfg';
import VueFormGenerator from 'vue-form-generator';
import { DataItem, Repository, OperationReply } from '../../store/repository';
import { router } from '../../router';

@Component
export default class DynamicFormComponent extends Vue {
    @Prop()
    id: string;

    @Prop()
    operation: string;

    @Watch('id')
    onIdChanged(val: string, oldVal: string) {
        if (this.updateTimeout === 0) {
            this.updateTimeout = setTimeout(this.updateForm, 125);
        }
    }

    @Watch('operation')
    onOperationChanged(val: string, oldVal: string) {
        if (this.updateTimeout === 0) {
            this.updateTimeout = setTimeout(this.updateForm, 125);
        }
    }

    components = {
        'vue-form-generator': VueFormGenerator.component
    };

    activity = false;
    errorMessage = '';
    formOptions: VFGOptions = {
        validateAfterLoad: true,
        validateAfterChanged: true
    };
    isValid = false;
    model: any = { dataType: this.$route.name };
    parentRepository: Repository = null;
    repository: Repository = null;
    schema: Schema = {};
    updateTimeout = 0;
    vm: any;
    vmDefinition: Array<FieldDefinition>;

    beforeRouteUpdate(to: VueRouter.Route, from: VueRouter.Route, next: Function) {
        this.repository = new Repository(this.$route.name);
        if (this.updateTimeout === 0) {
            this.updateTimeout = setTimeout(this.updateForm, 125);
        }
        next();
    }

    mounted() {
        this.repository = new Repository(this.$route.name);
        if (this.updateTimeout === 0) {
            this.updateTimeout = setTimeout(this.updateForm, 125);
        }
    }

    onValidated(isValid: boolean, errors: Array<any>) {
        this.isValid = isValid;
    }

    addFieldToSchema(field: FieldDefinition, beginning: boolean) {
        let newField: FieldDefinition = Object.assign({}, field);
        if (newField.type.startsWith("object")) {
            if (newField.type === "object"
                || newField.type === "objectSelect"
                || newField.type == "objectReference") {
                let idField = this.vmDefinition.find(v => v.model === newField.model + "Id");
                if (idField) {
                    newField.buttons = [];
                    if (newField.type === "objectSelect"
                        && (this.operation === "edit" || this.operation === "create")) {
                        newField.buttons.push({
                            classes: 'btn btn--dark btn--flat primary--text',
                            label: 'Select',
                            onclick: function (model, field: FieldDefinition) {
                                router.push({
                                    name: newField.inputType + "DataTable",
                                    params: {
                                        childProp: newField.inverseType,
                                        operation: 'select',
                                        parentType: model.dataType,
                                        parentId: model.id,
                                        parentProp: newField.model
                                    }
                                });
                            }
                        });
                    }
                    this.addObjectButtons(newField, idField);
                }
            } else if (newField.type === "objectMultiSelect") {
                newField.buttons = [{
                    classes: 'btn btn--dark btn--flat info--text',
                    label: 'View/Edit',
                    onclick: function (model, field: FieldDefinition) {
                        router.push({
                            name: newField.inputType + "DataTable",
                            params: {
                                operation: 'multiselect',
                                parentType: model.dataType,
                                parentId: model.id,
                                parentProp: newField.model
                            }
                        });
                    }
                }];
            } else {
                newField.buttons = [{
                    classes: 'btn btn--dark btn--flat info--text',
                    label: 'View/Edit',
                    onclick: function (model, field: FieldDefinition) {
                        router.push({
                            name: newField.inputType + "DataTable",
                            params: {
                                childProp: newField.inverseType,
                                operation: 'collection',
                                parentType: model.dataType,
                                parentId: model.id,
                                parentProp: newField.model
                            }
                        });
                    }
                }];
            }
            newField.type = "label";
        }
        if (field.groupName) {
            let group = this.schema.groups.find(g => g.legend == field.groupName);
            if (beginning) {
                group.fields.unshift(newField);
            } else {
                group.fields.push(newField);
            }
        } else if (beginning) {
            this.schema.fields.unshift(newField);
        } else {
            this.schema.fields.push(newField);
        }
    }

    addNew: Function = function (model, field: FieldDefinition) {
        this.repository.add(this.$route.fullPath, field.inverseType, model.id)
            .then(data => {
                this.activity = false;
                if (data.error) {
                    this.errorMessage = data.error;
                } else {
                    this.errorMessage = '';
                    this.$router.push({ name: field.inputType, params: { operation: 'create', id: data.data.id } });
                }
            })
            .catch(error => {
                this.activity = false;
                this.errorMessage = "A problem occurred. The new item could not be added.";
                ErrorMsg.logError("dynamic-form.addNew", new Error(error));
            });
    }.bind(this);

    addObjectButtons(newField: FieldDefinition, idField: FieldDefinition) {
        if ((this.operation === "edit" || this.operation === "create")
            && newField.type !== "objectReference"
            && (newField.type === "objectSelect"
                || !this.model[idField.model])) {
            newField.buttons.push({
                classes: 'btn btn--dark btn--flat success--text',
                label: 'Add',
                onclick: !this.model[idField.model]
                    ? this.addNew
                    : function (model, field: FieldDefinition, event: Event) {
                        event.stopPropagation();
                        model.replaceProp = field.model;
                        model.replaceType = field.inputType;
                        Vue.set(model, 'replaceDialogShown', true);
                    }
            });
        }
        if (this.model[idField.model]) {
            newField.buttons.push({
                classes: 'btn btn--dark btn--flat info--text',
                label: 'View/Edit',
                onclick: function (model, field: FieldDefinition) {
                    router.push({ name: newField.inputType, params: { operation: 'details', id: model[field.model + "Id"] } });
                }
            });
        }
        if ((this.operation === "edit" || this.operation === "create")
            && newField.type !== "objectReference"
            && !newField.required
            && this.model[idField.model]) {
            newField.buttons.push({
                classes: 'btn btn--dark btn--flat error--text',
                label: 'Delete',
                onclick: function (model, field: FieldDefinition, event: Event) {
                    event.stopPropagation();
                    model.deleteProp = field.model;
                    Vue.set(model, 'deleteDialogShown', true);
                }
            });
        }
    }

    onCancel() {
        this.activity = false;
        this.errorMessage = '';
        if (this.operation === 'create') {
            this.repository.remove(this.$route.fullPath, this.id)
                .then(data => {
                    this.activity = false;
                    if (data.error) {
                        this.errorMessage = data.error;
                    }
                    else {
                        this.$router.go(-1);
                    }
                })
                .catch(error => {
                    this.errorMessage = "A problem occurred. The item could not be removed.";
                    this.activity = false;
                    ErrorMsg.logError("dynamic-form.onCancel", new Error(error));
                });
        } else {
            this.$router.go(-1);
        }
    }

    onCancelDelete() {
        delete this.model.deleteProp;
        this.model.deleteDialogShown = false;
    }

    onCancelReplace() {
        delete this.model.replaceProp;
        delete this.model.replaceType;
        this.model.replaceDialogShown = false;
    }

    onDelete() {
        this.activity = true;
        this.repository.removeFromParent(this.$route.fullPath, this.id, this.model.deleteProp)
            .then(data => {
                if (data.error) {
                    this.errorMessage = data.error;
                    this.activity = false;
                }
                else {
                    this.updateForm();
                }
                this.onCancelDelete();
            })
            .catch(error => {
                this.errorMessage = "A problem occurred. The item could not be removed.";
                this.activity = false;
                ErrorMsg.logError("dynamic-form.onDelete", new Error(error));
            });
    }

    onEdit() {
        this.$router.push({ name: this.$route.name, params: { operation: 'edit', id: this.id } });
    }

    onSave() {
        this.activity = true;
        this.errorMessage = '';
        let d = Object.assign({
            id: this.id,
            updateTimestamp: Date.now()
        },
            this.model);
        // Remove unsupported or null properties from the ViewModel before sending for update,
        // to avoid errors when overwriting values with the placeholders.
        delete d.dataType;
        for (var prop in d) {
            if (d[prop] === "[None]" || d[prop] === "[...]") {
                delete d[prop];
            }
        }
        this.repository.update(this.$route.fullPath, d)
            .then(data => {
                if (data.error) {
                    this.errorMessage = data.error;
                } else {
                    this.$router.go(-1);
                }
                this.errorMessage = '';
                this.activity = false;
            })
            .catch(error => {
                this.errorMessage = "A problem occurred. The item could not be updated.";
                this.activity = false;
                ErrorMsg.logError("dynamic-form.onSave", new Error(error));
            });
    }

    onReplace() {
        this.repository.replaceChildWithNew(this.$route.fullPath, this.id, this.model.replaceProp)
            .then(data => {
                if (data.error) {
                    this.errorMessage = data.error;
                } else {
                    this.errorMessage = '';
                    this.$router.push({ name: this.model.replaceType, params: { operation: 'create', id: data.data.id } });
                }
                this.onCancelReplace();
                this.activity = false;
            })
            .catch(error => {
                this.errorMessage = "A problem occurred. The item could not be added.";
                this.activity = false;
                ErrorMsg.logError("dynamic-form.onReplace", new Error(error));
            });
    }

    updateForm() {
        this.activity = true;
        this.updateTimeout = 0;
        this.errorMessage = '';
        this.repository.find(this.$route.fullPath, this.id)
            .then(data => {
                this.model = { dataType: this.$route.name };
                this.schema = { fields: [] };
                if (data.error) {
                    this.errorMessage = data.error;
                    this.activity = false;
                } else {
                    this.repository.getFieldDefinitions(this.$route.fullPath)
                        .then(defData => {
                            this.vmDefinition = defData;
                            this.vm = data.data;
                            let groups = this.vmDefinition.filter(v => v.groupName !== undefined && v.groupName !== null).map(v => v.groupName);
                            if (groups.length) {
                                this.schema.groups = [];
                                for (var i = 0; i < groups.length; i++) {
                                    this.schema.groups[i] = {
                                        legend: groups[i],
                                        fields: []
                                    };
                                }
                            }
                            this.vmDefinition.forEach(field => {
                                this.model[field.model] = field.default || null;
                            });
                            for (var prop in this.vm) {
                                this.model[prop] = this.vm[prop];
                            }
                            this.vmDefinition.forEach(field => {
                                this.addFieldToSchema(field, field.label === "Name" || field.placeholder === "Name");
                            });
                            if (this.operation === 'details') {
                                this.schema.fields.forEach(f => f.disabled = true);
                            }
                            this.errorMessage = '';
                            this.activity = false;
                        })
                        .catch(error => {
                            this.errorMessage = "A problem occurred while updating the data.";
                            this.activity = false;
                            ErrorMsg.logError("dynamic-form.updateForm", new Error(error));
                        });
                }
            })
            .catch(error => {
                this.errorMessage = "A problem occurred while updating the data.";
                this.activity = false;
                ErrorMsg.logError("dynamic-form.updateForm", new Error(error));
            });
    }
}