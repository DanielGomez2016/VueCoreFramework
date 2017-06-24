﻿import Vue from 'vue';
import VueRouter from 'vue-router';
import { Component, Prop, Watch } from 'vue-property-decorator';
import * as ErrorMsg from '../../error-msg';
import { DataItem, PageData, Repository } from '../../store/repository';
import { permissionIncludesTarget, permissions, ShareData } from '../../store/userStore';
import { ApiResponseViewModel, checkResponse } from '../../router';

/**
 * Describes the header of a Vuetify data table.
 */
interface TableHeader {
    /**
     * The text displayed in the header.
     */
    text: string;

    /**
     * The name of the model property used to get the value for the column.
     */
    value: string;

    /**
     * Optionally indicates that this column is left-aligned (right-align is the default).
     */
    left?: boolean;

    /**
     * Optionally indicates that this column is sortable (false by default).
     */
    sortable?: boolean;
}

/**
 * A set of pagination options used by the Vuetify data table.
 */
interface Pagination {
    /**
     * An optional property name which will be used to sort the items before calculating the page contents.
     */
    sortBy?: string;

    /**
     * Optionally indicates that the sort is descending (ascending by default).
     */
    descending?: boolean;

    /**
     * The page number requested.
     */
    page?: number;

    /**
     * The number of items per page.
     */
    rowsPerPage?: number;
}

@Component
export default class DynamicTableComponent extends Vue {
    @Prop()
    childProp: string;

    @Prop()
    operation: string;

    @Prop()
    parentId: string;

    @Prop()
    parentProp: string;

    @Prop()
    parentType: string;

    activity = false;
    allPermission = false;
    canAdd = false;
    canShare = false;
    canDelete = false;
    canDeleteChildren = false;
    childItems: Array<DataItem> = [];
    childLoading = true;
    childPagination: Pagination = {};
    childSearch = '';
    deleteDialogShown = false;
    deleteAskingChildItems = [];
    deleteAskingItems = [];
    deletePendingChildItems = [];
    deletePendingItems = [];
    deletePermissions: any = {};
    deleteChildPermissions: any = {};
    errorMessage = '';
    groupMembers: string[] = [];
    headers: Array<TableHeader> = [];
    items: Array<DataItem> = [];
    loading = true;
    pagination: Pagination = {};
    parentRepository: Repository = null;
    permissionOptions = [
        { text: 'View', value: permissions.permissionDataView },
        { text: 'Edit', value: permissions.permissionDataEdit },
        { text: 'Add', value: permissions.permissionDataAdd },
        { text: 'All', value: permissions.permissionDataAll }
    ];
    repository: Repository = null;
    routeName = '';
    search = '';
    selectedPermission = null;
    selectedShareGroup = null;
    selectedShareUsername = null;
    selectErrorDialogMessage = '';
    selectErrorDialogShown = false;
    selected: Array<DataItem> = [];
    selectedChildren: Array<DataItem> = [];
    shareActivity = false;
    shareDialog = false;
    shareErrorMessage = '';
    shareGroups: string[] = [];
    shareGroup = '';
    shareGroupSuggestion = '';
    shareGroupTimeout = 0;
    shareUsernameSuggestion = '';
    shareUsernameTimeout = 0;
    shares: ShareData[] = [];
    shareUsername = '';
    shareWithAll = false;
    totalChildItems = 0;
    totalItems = 0;
    updateTimeout = 0;

    @Watch('childPagination', { deep: true })
    onChildPaginationChange(val: Pagination, oldVal: Pagination) {
        this.updateChildData();
    }

    @Watch('childSearch')
    onChildSearchChange(val: string, oldVal: string) {
        this.updateChildData();
    }

    @Watch('parentType')
    onParentTypeChanged(val: string, oldVal: string) {
        this.parentRepository = this.$store.getters.getRepository(val);
        if (this.updateTimeout === 0) {
            this.updateTimeout = setTimeout(this.updateTable, 125);
        }
    }

    @Watch('search')
    onSearchChange(val: string, oldVal: string) {
        this.updateData();
    }

    @Watch('shareDialog')
    onShareDialogChange(val: boolean, oldVal: boolean) {
        if (val) {
            this.updateShares();
        }
    }

    @Watch('pagination', { deep: true })
    onPaginationChange(val: Pagination, oldVal: Pagination) {
        this.updateData();
    }

    @Watch('$route')
    onRouteChange(val: VueRouter.Route, oldVal: VueRouter.Route) {
        this.routeName = val.name.substr(0, val.name.length - 9); // remove 'DataTable'
        this.repository = this.$store.getters.getRepository(this.routeName);
        if (this.updateTimeout === 0) {
            this.updateTimeout = setTimeout(this.updateTable, 125);
        }
    }

    mounted() {
        this.routeName = this.$route.name.substr(0, this.$route.name.length - 9); // remove 'DataTable'
        this.repository = this.$store.getters.getRepository(this.routeName);
        if (this.parentType) {
            this.parentRepository = this.$store.getters.getRepository(this.parentType);
        }
        if (this.updateTimeout === 0) {
            this.updateTimeout = setTimeout(this.updateTable, 125);
        }
    }

    cancelDelete(id: string) {
        let index = this.deleteAskingItems.indexOf(id);
        if (index !== -1) {
            this.deleteAskingItems.splice(index, 1);
        }
    }

    cancelDeleteChild(id: string) {
        let index = this.deleteAskingChildItems.indexOf(id);
        if (index !== -1) {
            this.deleteAskingChildItems.splice(index, 1);
        }
    }

    getChildData(): Promise<PageData<DataItem>> {
        this.childLoading = true;
        return new Promise((resolve, reject) => {
            const { sortBy, descending, page, rowsPerPage } = this.childPagination;
            this.parentRepository.getChildPage(this.$route.fullPath, this.parentId, this.parentProp, this.childSearch, sortBy, descending, page, rowsPerPage)
                .then(data => {
                    this.childLoading = false;
                    resolve({
                        pageItems: data.pageItems,
                        totalItems: data.totalItems
                    });
                })
                .catch(error => {
                    this.childLoading = false;
                    ErrorMsg.logError("dynamic-table.getChildData", new Error(error));
                    reject("A problem occurred while loading the data.");
                });
        });
    }

    getData(): Promise<PageData<DataItem>> {
        this.loading = true;
        return new Promise((resolve, reject) => {
            const { sortBy, descending, page, rowsPerPage } = this.pagination;
            if (this.parentRepository) {
                if (this.operation === "multiselect") {
                    this.parentRepository.getAllChildIds(this.$route.fullPath, this.parentId, this.parentProp)
                        .then(childIds => {
                            this.repository.getPage(this.$route.fullPath, this.search, sortBy, descending, page, rowsPerPage, childIds)
                                .then(data => {
                                    this.loading = false;
                                    resolve({
                                        pageItems: data.pageItems,
                                        totalItems: data.totalItems
                                    });
                                })
                                .catch(error => {
                                    this.loading = false;
                                    ErrorMsg.logError("dynamic-table.getData", new Error(error));
                                    reject("A problem occurred while loading the data.");
                                });
                        })
                        .catch(error => {
                            this.loading = false;
                            ErrorMsg.logError("dynamic-table.getData", new Error(error));
                            reject("A problem occurred while loading the data.");
                        });
                } else {
                    this.parentRepository.getChildPage(this.$route.fullPath, this.parentId, this.parentProp, this.search, sortBy, descending, page, rowsPerPage)
                        .then(data => {
                            this.loading = false;
                            resolve({
                                pageItems: data.pageItems,
                                totalItems: data.totalItems
                            });
                        })
                        .catch(error => {
                            this.loading = false;
                            ErrorMsg.logError("dynamic-table.getData", new Error(error));
                            reject("A problem occurred while loading the data.");
                        });
                }
            } else {
                this.repository.getPage(this.$route.fullPath, this.search, sortBy, descending, page, rowsPerPage)
                    .then(data => {
                        this.loading = false;
                        resolve({
                            pageItems: data.pageItems,
                            totalItems: data.totalItems
                        });
                    })
                    .catch(error => {
                        this.loading = false;
                        ErrorMsg.logError("dynamic-table.getData", new Error(error));
                        reject("A problem occurred while loading the data.");
                    });
            }
        });
    }

    onAddSelect() {
        this.activity = true;
        this.parentRepository.addChildrenToCollection(this.$route.fullPath, this.parentId, this.parentProp, this.selected.map(c => c[c.primaryKeyProperty]))
            .then(data => {
                if (data.error) {
                    this.errorMessage = data.error;
                }
                else {
                    this.selected = [];
                    this.updateData();
                    this.updateChildData();
                }
                this.activity = false;
            })
            .catch(error => {
                this.errorMessage = "A problem occurred. The item could not be removed.";
                this.activity = false;
                ErrorMsg.logError("dynamic-table.onAddSelect", new Error(error));
            });
    }

    onCancel() {
        this.activity = false;
        this.errorMessage = '';
        this.$router.go(-1);
    }

    onDelete() {
        this.activity = true;
        if (this.operation === 'collection') {
            this.repository.removeRangeFromParent(this.$route.fullPath, this.childProp, this.selected.map(i => i[i.primaryKeyProperty]))
                .then(data => {
                    if (data.error) {
                        this.errorMessage = data.error;
                    } else {
                        for (var i = 0; i < this.selected.length; i++) {
                            this.items.splice(this.items.findIndex(d => d[d.primaryKeyProperty] == this.selected[i][this.selected[i].primaryKeyProperty]), 1);
                        }
                        this.selected = [];
                    }
                    this.activity = false;
                })
                .catch(error => {
                    this.errorMessage = "A problem occurred. The item(s) could not be removed.";
                    this.activity = false;
                    ErrorMsg.logError("dynamic-table.onDelete", new Error(error));
                });
        } else {
            this.repository.removeRange(this.$route.fullPath, this.selected.map(i => i[i.primaryKeyProperty]))
                .then(data => {
                    if (data.error) {
                        this.errorMessage = data.error;
                    } else {
                        for (var i = 0; i < this.selected.length; i++) {
                            this.items.splice(this.items.findIndex(d => d[d.primaryKeyProperty] == this.selected[i][this.selected[i].primaryKeyProperty]), 1);
                        }
                        this.selected = [];
                    }
                    this.activity = false;
                })
                .catch(error => {
                    this.errorMessage = "A problem occurred. The item(s) could not be removed.";
                    this.activity = false;
                    ErrorMsg.logError("dynamic-table.onDelete", new Error(error));
                });
        }
    }

    onDeleteChildItem(id: string) {
        this.activity = true;
        this.deletePendingChildItems.push(id);
        this.cancelDeleteChild(id); // removes from asking
        if (this.operation === 'collection') {
            this.repository.removeFromParent(this.$route.fullPath, id, this.childProp)
                .then(data => {
                    if (data.error) {
                        this.errorMessage = data.error;
                    }
                    else {
                        this.items.splice(this.items.findIndex(d => d[d.primaryKeyProperty] == id), 1);
                        let index = this.deletePendingChildItems.indexOf(id);
                        if (index !== -1) {
                            this.deletePendingChildItems.splice(index, 1);
                        }
                    }
                    this.activity = false;
                })
                .catch(error => {
                    this.errorMessage = "A problem occurred. The item could not be removed.";
                    this.activity = false;
                    ErrorMsg.logError("dynamic-table.onDeleteChildItem", new Error(error));
                });
        } else {
            this.repository.remove(this.$route.fullPath, id)
                .then(data => {
                    if (data.error) {
                        this.errorMessage = data.error;
                    }
                    else {
                        this.items.splice(this.items.findIndex(d => d[d.primaryKeyProperty] == id), 1);
                        let index = this.deletePendingChildItems.indexOf(id);
                        if (index !== -1) {
                            this.deletePendingChildItems.splice(index, 1);
                        }
                    }
                    this.activity = false;
                })
                .catch(error => {
                    this.errorMessage = "A problem occurred. The item could not be removed.";
                    this.activity = false;
                    ErrorMsg.logError("dynamic-table.onDeleteChildItem", new Error(error));
                });
        }
    }

    onDeleteItem(id: string) {
        this.activity = true;
        this.deletePendingItems.push(id);
        this.cancelDelete(id); // removes from asking
        if (this.operation === 'collection') {
            this.repository.removeFromParent(this.$route.fullPath, id, this.childProp)
                .then(data => {
                    if (data.error) {
                        this.errorMessage = data.error;
                    }
                    else {
                        this.items.splice(this.items.findIndex(d => d[d.primaryKeyProperty] == id), 1);
                        let index = this.deletePendingItems.indexOf(id);
                        if (index !== -1) {
                            this.deletePendingItems.splice(index, 1);
                        }
                    }
                    this.activity = false;
                })
                .catch(error => {
                    this.errorMessage = "A problem occurred. The item could not be removed.";
                    this.activity = false;
                    ErrorMsg.logError("dynamic-table.onDeleteItem", new Error(error));
                });
        } else {
            this.repository.remove(this.$route.fullPath, id)
                .then(data => {
                    if (data.error) {
                        this.errorMessage = data.error;
                    }
                    else {
                        this.items.splice(this.items.findIndex(d => d[d.primaryKeyProperty] == id), 1);
                        let index = this.deletePendingItems.indexOf(id);
                        if (index !== -1) {
                            this.deletePendingItems.splice(index, 1);
                        }
                    }
                    this.activity = false;
                })
                .catch(error => {
                    this.errorMessage = "A problem occurred. The item could not be removed.";
                    this.activity = false;
                    ErrorMsg.logError("dynamic-table.onDeleteItem", new Error(error));
                });
        }
    }

    onDuplicate(id: string) {
        this.activity = true;
        this.repository.duplicate(this.$route.fullPath, id)
            .then(data => {
                if (data.error) {
                    this.errorMessage = data.error;
                }
                else {
                    this.$router.push({ name: this.routeName, params: { operation: 'add', id: data.data[data.data.primaryKeyProperty] } });
                }
                this.activity = false;
            })
            .catch(error => {
                this.errorMessage = "A problem occurred. The item could not be copied.";
                this.activity = false;
                ErrorMsg.logError("dynamic-table.onDuplicate", new Error(error));
            });
    }

    onHide(share: ShareData) {
        this.shareActivity = true;
        this.shareErrorMessage = '';
        let action: string;
        if (share.name === 'All Users') {
            action = 'HideDataFromAll';
        }
        if (share.type === 'user') {
            action = `HideDataFromUser/${share.name}`;
        } else {
            action = `HideDataFromGroup/${share.name}`;
        }
        fetch(`/api/Authorization/${action}/${this.routeName}?operation=${encodeURIComponent(share.level)}`,
            {
                method: 'POST',
                headers: {
                    'Accept': 'application/json',
                    'Authorization': `bearer ${this.$store.state.userState.token}`
                }
            })
            .then(response => checkResponse(response, this.$route.fullPath))
            .then(response => response.json() as Promise<ApiResponseViewModel>)
            .then(data => {
                if (data.error) {
                    this.shareErrorMessage = data.error;
                } else {
                    this.updateShares();
                }
                this.shareActivity = false;
            })
            .catch(error => {
                this.shareErrorMessage = 'A problem occurred.';
                ErrorMsg.logError('dynamic-table.onHide', error);
            });
    }

    onNew() {
        this.repository.add(
            this.$route.fullPath,
            this.operation === 'collection' ? this.childProp : undefined,
            this.operation === 'collection' ? this.parentId : undefined)
            .then(data => {
                this.activity = false;
                if (data.error) {
                    this.errorMessage = data.error;
                } else {
                    this.errorMessage = '';
                    this.$router.push({ name: this.routeName, params: { operation: 'add', id: data.data[data.data.primaryKeyProperty] } });
                }
            })
            .catch(error => {
                this.activity = false;
                this.errorMessage = "A problem occurred. The new item could not be added.";
                ErrorMsg.logError("dynamic-table.onNew", new Error(error));
            });
    }

    onRemoveSelect() {
        this.activity = true;
        this.parentRepository.removeChildrenFromCollection(this.$route.fullPath, this.parentId, this.parentProp, this.selectedChildren.map(c => c[c.primaryKeyProperty]))
            .then(data => {
                if (data.error) {
                    this.errorMessage = data.error;
                }
                else {
                    this.selectedChildren = [];
                    this.updateData();
                    this.updateChildData();
                }
                this.activity = false;
            })
            .catch(error => {
                this.errorMessage = "A problem occurred. The item could not be removed.";
                this.activity = false;
                ErrorMsg.logError("dynamic-table.onDeleteChildItem", new Error(error));
            });
    }
    
    onSelectedShareGroupChange(val: string, oldVal: string) {
        this.shareGroup = val;
    }
    
    onSelectedShareUsernameChange(val: string, oldVal: string) {
        this.shareUsername = val;
    }

    onSelectItem() {
        if (!this.selected.length) {
            this.selectErrorDialogMessage = "You have not selected an item.";
            this.selectErrorDialogShown = true;
        } else if (this.selected.length > 1) {
            this.selectErrorDialogMessage = "You can only select a single item.";
            this.selectErrorDialogShown = true;
        } else if (this.childProp) {
            this.repository.replaceChild(this.$route.fullPath, this.parentId, this.selected[0][this.selected[0].primaryKeyProperty], this.childProp)
                .then(data => {
                    if (data.error) {
                        this.errorMessage = data.error;
                    } else {
                        this.$router.go(-1);
                    }
                    this.activity = false;
                })
                .catch(error => {
                    this.errorMessage = "A problem occurred. The item could not be updated.";
                    this.activity = false;
                    ErrorMsg.logError("dynamic-table.onSelectItem", new Error(error));
                });
        } else {
            this.errorMessage = "There was a problem saving your selection. Please try going back to the previous page before trying again.";
        }
    }

    onShare() {
        if (this.selectedPermission || this.allPermission) {
            if (this.shareWithAll) {
                this.share('ShareDataWithAll');
            }
            if (this.shareGroup) {
                this.share('ShareDataWithGroup', this.shareGroup);
            }
            if (this.shareUsername) {
                this.share('ShareDataWithUser', this.shareUsername);
            }
        }
    }
    
    onShareGroupChange(val: string, oldVal: string) {
        if (this.shareGroupTimeout === 0) {
            this.shareGroupTimeout = setTimeout(this.suggestShareGroup, 500);
        }
    }
    
    onShareUsernameChange(val: string, oldVal: string) {
        if (this.shareUsernameTimeout === 0) {
            this.shareUsernameTimeout = setTimeout(this.suggestShareUsername, 500);
        }
    }

    onViewChildItem(id: string) {
        this.$router.push({ name: this.parentType.toLowerCase(), params: { operation: 'view', id } });
    }

    onViewItem(id: string) {
        this.$router.push({ name: this.routeName, params: { operation: 'view', id } });
    }

    share(action: string, target?: string) {
        this.shareActivity = true;
        this.shareErrorMessage = '';
        let url = `/api/Authorization/${action}`;
        if (target) {
            url += `/${target}`;
        }
        url += `/${this.routeName}`;
        if (!this.allPermission) {
            url += `?operation=${encodeURIComponent(this.selectedPermission)}`;
        }
        fetch(url,
            {
                method: 'POST',
                headers: {
                    'Accept': 'application/json',
                    'Authorization': `bearer ${this.$store.state.userState.token}`
                }
            })
            .then(response => checkResponse(response, this.$route.fullPath))
            .then(response => response.json() as Promise<ApiResponseViewModel>)
            .then(data => {
                if (data.error) {
                    this.shareErrorMessage = data.error;
                } else {
                    this.updateShares();
                }
                this.shareActivity = false;
            })
            .catch(error => {
                this.shareErrorMessage = 'A problem occurred.';
                this.shareActivity = false;
                ErrorMsg.logError('dynamic-table.share', error);
            });
    }

    suggestShareGroup() {
        this.shareGroupTimeout = 0;
        if (this.shareGroup) {
            fetch(`/api/Authorization/GetShareableGroupCompletion/${this.shareGroup}`,
                {
                    method: 'GET',
                    headers: {
                        'Accept': 'application/json',
                        'Authorization': `bearer ${this.$store.state.userState.token}`
                    }
                })
                .then(response => checkResponse(response, this.$route.fullPath))
                .then(response => response.json() as Promise<ApiResponseViewModel>)
                .then(data => {
                    if (data['error']) {
                        throw new Error(`There was a problem retrieving a share group suggestion: ${data['error']}`);
                    } else {
                        this.shareGroupSuggestion = data.response;
                    }
                })
                .catch(error => {
                    ErrorMsg.logError('dynamic-table.suggestShareGroup', error);
                });
        }
    }

    suggestShareUsername() {
        this.shareUsernameTimeout = 0;
        if (this.shareUsername) {
            fetch(`/api/Authorization/GetShareableUsernameCompletion/${this.shareUsername}`,
                {
                    method: 'GET',
                    headers: {
                        'Accept': 'application/json',
                        'Authorization': `bearer ${this.$store.state.userState.token}`
                    }
                })
                .then(response => checkResponse(response, this.$route.fullPath))
                .then(response => response.json() as Promise<ApiResponseViewModel>)
                .then(data => {
                    if (data['error']) {
                        throw new Error(`There was a problem retrieving a share group suggestion: ${data['error']}`);
                    } else {
                        this.shareUsernameSuggestion = data.response;
                    }
                })
                .catch(error => {
                    ErrorMsg.logError('dynamic-table.suggestShareUsername', error);
                });
        }
    }

    updateChildData() {
        if (this.parentRepository) {
            this.getChildData()
                .then((data: PageData<DataItem>) => {
                    this.childItems = data.pageItems;
                    this.totalChildItems = data.totalItems;

                    this.deleteChildPermissions = {};
                    let deleteAny = this.canShare; // Admins can delete anything.
                    if (!deleteAny) {
                        let permission = this.$store.getters.getPermission(this.routeName);
                        if (permission === permissions.permissionDataAll) {
                            deleteAny = true;
                        }
                    }
                    for (var i = 0; i < this.items.length; i++) {
                        if (deleteAny) {
                            this.deleteChildPermissions[this.items[i][this.items[i].primaryKeyProperty]] = true;
                        } else {
                            let permission = this.$store.getters.getPermission(this.routeName, this.items[i][this.items[i].primaryKeyProperty]);
                            this.deleteChildPermissions[this.items[i][this.items[i].primaryKeyProperty]] =
                                permission === permissions.permissionDataAll;
                        }
                    }
                    this.canDeleteChildren = Object.keys(this.deleteChildPermissions).length > 0;
                })
                .catch(error => {
                    this.errorMessage = "A problem occurred while loading the data.";
                    ErrorMsg.logError("dynamic-table.updateChildData", new Error(error));
                });
        }
    }

    updateData() {
        if (this.repository) {
            this.getData()
                .then((data: PageData<DataItem>) => {
                    this.items = data.pageItems;
                    this.totalItems = data.totalItems;

                    this.deletePermissions = {};
                    let deleteAny = this.canShare; // Admins can delete anything.
                    if (!deleteAny) {
                        let permission = this.$store.getters.getPermission(this.routeName);
                        if (permission === permissions.permissionDataAll) {
                            deleteAny = true;
                        }
                    }
                    for (var i = 0; i < this.items.length; i++) {
                        if (deleteAny) {
                            this.deletePermissions[this.items[i][this.items[i].primaryKeyProperty]] = true;
                        } else {
                            let permission = this.$store.getters.getPermission(this.routeName, this.items[i][this.items[i].primaryKeyProperty]);
                            this.deletePermissions[this.items[i][this.items[i].primaryKeyProperty]] =
                                permission === permissions.permissionDataAll;
                        }
                    }
                    this.canDelete = Object.keys(this.deletePermissions).length > 0;
                })
                .catch(error => {
                    this.errorMessage = "A problem occurred while loading the data.";
                    ErrorMsg.logError("dynamic-table.updateData", new Error(error));
                });
        }
    }

    updateShares() {
        fetch(`/api/Authorization/GetCurrentShares/${this.routeName}`,
            {
                method: 'GET',
                headers: {
                    'Accept': 'application/json',
                    'Authorization': `bearer ${this.$store.state.userState.token}`
                }
            })
            .then(response => checkResponse(response, this.$route.fullPath))
            .then(response => response.json() as Promise<Array<ShareData>>)
            .then(data => {
                if (data['error']) {
                    throw new Error(`There was a problem retrieving current shares: ${data['error']}`);
                } else {
                    this.shares = [];
                    for (var i = 0; i < data.length; i++) {
                        this.shares[i] = data[i];
                        this.shares[i].id = i;
                    }
                }
            })
            .catch(error => {
                ErrorMsg.logError('dynamic-table.updateShares', error);
            });
        fetch(`/api/Authorization/GetShareableGroupMembers`,
            {
                method: 'GET',
                headers: {
                    'Accept': 'application/json',
                    'Authorization': `bearer ${this.$store.state.userState.token}`
                }
            })
            .then(response => checkResponse(response, this.$route.fullPath))
            .then(response => response.json() as Promise<Array<string>>)
            .then(data => {
                if (data['error']) {
                    throw new Error(`There was a problem retrieving sharable group members: ${data['error']}`);
                } else {
                    this.groupMembers = data;
                }
            })
            .catch(error => {
                ErrorMsg.logError('dynamic-table.updateShares', error);
            });
        fetch(`/api/Authorization/GetShareableGroupSubset`,
            {
                method: 'GET',
                headers: {
                    'Accept': 'application/json',
                    'Authorization': `bearer ${this.$store.state.userState.token}`
                }
            })
            .then(response => checkResponse(response, this.$route.fullPath))
            .then(response => response.json() as Promise<Array<string>>)
            .then(data => {
                if (data['error']) {
                    this.shareGroups = [];
                    throw new Error(`There was a problem retrieving sharable groups: ${data['error']}`);
                } else {
                    this.shareGroups = data;
                }
            })
            .catch(error => {
                ErrorMsg.logError('dynamic-table.updateShares', error);
            });
    }

    updateTable() {
        this.updateTimeout = 0;
        this.activity = true;

        this.canShare = this.$store.state.userState.isAdmin && this.$store.getters.getSharePermission(this.routeName);

        let permission = this.$store.getters.getPermission(this.routeName);
        this.canAdd = permissionIncludesTarget(permission, permissions.permissionDataAdd);

        this.headers = [];
        this.repository.getFieldDefinitions(this.$route.fullPath)
            .then(defData => {
                defData.forEach(field => {
                    if (!field.hideInTable && field.visible !== false) {
                        let h: TableHeader = {
                            text: field.label || field.placeholder,
                            value: field.model,
                            sortable: ((field.type === 'input'
                                && (field.inputType === 'text'
                                    || field.inputType === 'number'
                                    || field.inputType === 'email'
                                    || field.inputType === 'telephone'
                                    || field.inputType === 'range'
                                    || field.inputType === 'time'
                                    || field.inputType === 'date'
                                    || field.inputType === 'datetime'
                                    || field.inputType === 'datetime-local'))
                                || field.type === 'vuetifyText'
                                || field.type === 'vuetifyDateTime'
                                || field.type === 'vuetifyTimespan')
                        };
                        if (field.type === 'vuetifySelect'
                            || field.type === 'vuetifyDateTime'
                            || field.type === 'vuetifyTimespan') {
                            h.value = field.model + "Formatted";
                        }
                        if (field.isName) {
                            h.left = true;
                            this.headers.unshift(h);
                        } else {
                            this.headers.push(h);
                        }
                    }
                });
                this.updateData();
                this.updateChildData();
                this.activity = false;
            })
            .catch(error => {
                this.errorMessage = "A problem occurred while updating the data.";
                this.activity = false;
                ErrorMsg.logError("dynamic-table.mounted", error);
            });
    }
}