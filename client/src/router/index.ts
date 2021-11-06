import Vue from "vue";
import VueRouter, { RouteConfig } from "vue-router";
import Waiting from "@/views/Waiting.vue";
import Loading from "@/views/Loading.vue";

Vue.use(VueRouter);

const routes: Array<RouteConfig> = [
    {
        path: "/",
        name: "Waiting",
        component: Waiting,
    },
    {
        path: "/about",
        name: "About",
        // route level code-splitting
        // this generates a separate chunk (about.[hash].js) for this route
        // which is lazy-loaded when the route is visited.
        component: () => import(/* webpackChunkName: "about" */ "../views/Waiting.vue"),
    },
    {
        path: "/loading",
        name: "Loading",
        component: Loading,
    }
];

const router = new VueRouter({
    routes,
});

export default router;
