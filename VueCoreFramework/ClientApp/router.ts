﻿import VueRouter from 'vue-router';
import * as Store from './store/store';
import { SharePermissionData } from './store/userStore';
import * as ErrorMsg from './error-msg';

const routes: Array<VueRouter.RouteConfig> = [
    { path: '/', component: require('./components/home/home.vue') },
    {
        path: '/login',
        component: require('./components/user/login.vue'),
        props: (route) => ({ returnUrl: route.query.returnUrl })
    },
    {
        path: '/register',
        component: require('./components/user/register.vue'),
        props: (route) => ({ returnUrl: route.query.returnUrl })
    },
    {
        path: '/user/manage',
        meta: { requiresAuth: true },
        component: require('./components/user/manage.vue')
    },
    {
        path: '/user/email/confirm',
        component: require('./components/user/email/confirm.vue')
    },
    {
        path: '/user/email/restore',
        component: require('./components/user/email/restore.vue')
    },
    {
        path: '/user/reset/:code',
        component: require('./components/user/password/reset.vue'),
        props: true
    },
    { path: '/error/notfound', component: resolve => require(['./components/error/notfound.vue'], resolve) },
    { path: '/error/:code', component: resolve => require(['./components/error/error.vue'], resolve), props: true }
];

/**
 * The SPA framework's VueRouter instance.
 */
export const router = new VueRouter({
    mode: 'history',
    routes,
    scrollBehavior(to, from, savedPosition) {
        if (savedPosition) {
            return savedPosition; // return to last place if using back/forward
        } else if (to.hash) {
            return { selector: to.hash }; // scroll to anchor if provided
        } else {
            return { x: 0, y: 0 }; // reset to top-left
        }
    }
});
router.beforeEach((to, from, next) => {
    if (to.matched.some(record => record.meta.requiresAuth)) {
        checkAuthorization(to)
            .then(auth => {
                if (auth === "authorized") {
                    next();
                } else if (auth === "unauthorized") {
                    next({ path: '/error/401' });
                } else {
                    next({ path: '/login', query: { returnUrl: to.fullPath } });
                }
            })
            .catch(error => {
                ErrorMsg.logError("router.beforeEach", error);
                next({ path: '/login', query: { returnUrl: to.fullPath } });
            });
    } else {
        next();
    }
});

/**
 * A ViewModel used to receive a response from an API call, with an error and response string.
 */
export interface ApiResponseViewModel {
    error: string,
    response: string
}

/**
 * A ViewModel used to transfer information during user account authorization tasks.
 */
interface AuthorizationViewModel {
    /**
     * A value indicating whether the user is authorized for the requested action or not.
     */
    authorization: string;

    /**
     * Indicates that the user is authorized to share/hide the requested data.
     */
    canShare: boolean;

    /**
     * The email of the user account.
     */
    email: string;

    /**
     * A JWT bearer token.
     */
    token: string;

    /**
     * The username of the user account.
     */
    username: string;
}

/**
 * Calls an API endpoint which authorizes the current user for the route being navigated to.
 * @param to The Route being navigated to.
 * @returns {string} Either 'authorized' or 'unauthorized' or 'login' if the user must sign in.
 */
export function checkAuthorization(to: VueRouter.Route): Promise<string> {
    let url = '/api/Authorization/Authorize';
    let dataType: string;
    let op: string;
    let id: string;
    if (to && to.name && to.name.length) {
        dataType = to.name;
        if (dataType.endsWith("DataTable")) {
            dataType = dataType.substring(0, dataType.length - 9);
        } else {
            op = to.params.operation;
            id = to.params.id;
        }
        url += `?dataType=${dataType}`;
        if (op) url += `&operation=${op}`;
        if (id) url += `&id=${id}`;
    }
    return fetch(url,
        {
            headers: {
                'Authorization': `bearer ${Store.store.state.userState.token}`
            }
        })
        .then(response => {
            if (!response.ok) {
                if (response.status === 401) {
                    throw Error("unauthorized");
                }
                throw Error(response.statusText);
            }
            return response;
        })
        .then(response => response.json() as Promise<AuthorizationViewModel>)
        .then(data => {
            if (data.token) {
                Store.store.commit(Store.setToken, data.token);
            }
            if (data.username) {
                Store.store.commit(Store.setUsername, data.username);
            }
            if (data.email) {
                Store.store.commit(Store.setEmail, data.email);
            }
            if (data.canShare) {
                if (dataType) {
                    let permission: SharePermissionData = { dataType };
                    if (id) { // Permission to share/hide an item.
                        permission.id = id;
                    } else { // Permission to share/hide a type.
                        permission.canShare = true;
                    }
                    Store.store.commit(Store.updateSharePermission, permission);
                }
            }
            if (data.authorization === "authorized") {
                return "authorized";
            } else if (data.authorization === "unauthorized") {
                return "unauthorized";
            } else {
                return "login";
            }
        })
        .catch(error => {
            if (error.message !== "unauthorized") {
                ErrorMsg.logError("router.checkAuthorization", new Error(error));
            }
            return "unauthorized";
        });
}

/**
 * Verifies that the response of an API call was an OK response. If not, redirects to the login
 * page on 401, and throws an error otherwise.
 * @param response
 * @param {string} returnPath The page to redirect to after a successful login, if required.
 */
export function checkResponse(response: Response, returnPath: string) {
    if (!response.ok) {
        if (response.status === 401) {
            router.push({ path: '/login', query: { returnUrl: returnPath } });
        }
        throw Error(response.statusText);
    }
    return response;
}