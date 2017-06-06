﻿import { abstractField } from 'vue-form-generator';

export default {
    mixins: [abstractField],
    methods: {
        rules() {
            if (!this.errors.length) {
                return true;
            } else {
                return this.errors.join('; ');
            }
        }
    }
};