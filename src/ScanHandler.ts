import logger from "./config/logger";
import API, { APIResponse, ResponseType } from "./lib/API";
import DisplayError, { ReturnTarget } from "./lib/DisplayError";
import { UIState } from "./lib/UIState";
import WebSocketManager from "./lib/websockets/WebSocketManager";

export default class ScanHandler {
    private static LOGOUT_TIMEOUT = Number.parseInt(process.env.LOGOUT_TIMEOUT);

    public active = false;
    public busy = false;
    public uid: string | null = null;

    private socketManager: WebSocketManager;
    private api: API;
    private logoutTimeout: NodeJS.Timeout | null = null;

    constructor(socketManager: WebSocketManager, api: API) {
        this.socketManager = socketManager;
        this.api = api;
    }

    public async run(uid: string) {
        if (this.active) return;

        this.active = true;
        this.busy = true;

        this.socketManager.sendUI(UIState.GETTING_CHIP_INFO);

        let info: APIResponse;
        try {
            info = await this.api.unknownActionForUid(uid);
        } catch (err) {
            this.socketManager.catchError(err, "Error occurred while checking uid.");
            this.complete();
            return;
        }

        if (info.response == ResponseType.DEVICE_RETURNED) {
            // UUID is device and specified device got returned
            logger.debug(`Device returned (ID: ${info.device.id})`);
            this.socketManager.sendUI(UIState.DEVICE_RETURNED);
            this.complete();
        } else if (info.response == ResponseType.USER_INFO) {
            // UUID is user and info got returned
            this.uid = uid;
            this.socketManager.sendUI(UIState.USER_INFO, { user: info.user });
            this.complete(true, info.user.teacher);
        } else if (info.response.error) {
            // An server error occurred
            this.socketManager.sendError(
                new DisplayError(info.response, info.message, ReturnTarget.HOME),
            );
            this.complete();
        } else {
            // Unexpected result
            this.socketManager.sendError(
                new DisplayError(
                    ResponseType.UNEXPECTED_ERROR,
                    "Unknown API response.",
                    ReturnTarget.HOME,
                ),
            );
            this.complete();
        }
    }

    public async moreInput(uid: string) {
        if (!this.active || this.busy || this.uid == null) return;

        this.busy = true;

        if (uid == this.uid) {
            // Manual logout
            logger.info("User manually logged out");
            this.socketManager.sendUI(UIState.USER_LOGOUT);
            this.complete();
            return;
        }

        this.socketManager.sendUI(UIState.DEVICE_BOOKING_LOADING);

        let booking: APIResponse;
        try {
            booking = await this.api.book(this.uid, uid);
        } catch (err) {
            this.socketManager.catchError(err, "Error occurred while booking device.");
            this.complete();
            return;
        }

        if (booking.response.error) {
            logger.debug(`Booking failed (${booking.response.identifier}): ${booking.message}`);
            this.socketManager.sendError(
                new DisplayError(booking.response, booking.message, ReturnTarget.USER_HOME),
            );
            this.complete(booking.user.teacher, booking.user.teacher);
            return;
        }

        logger.debug(`Booking completed (ID: ${booking.device.id})`);
        this.socketManager.sendUI(
            UIState.DEVICE_BOOKING_COMPLETED,
            {},
            booking.user.teacher ? ReturnTarget.USER_HOME : ReturnTarget.HOME,
        );
        this.complete(booking.user.teacher, booking.user.teacher);
    }

    private complete(moreActionsAllowed = false, infiniteLogoutTimeout = false) {
        this.busy = true;
        this.active = moreActionsAllowed;

        // Handling logout timeout
        if (this.logoutTimeout) clearTimeout(this.logoutTimeout);
        if (moreActionsAllowed && !infiniteLogoutTimeout) {
            this.logoutTimeout = setTimeout(() => {
                this.socketManager.sendUI(UIState.USER_LOGOUT);
                this.complete();
            }, ScanHandler.LOGOUT_TIMEOUT);
        }
    }

    public cancel() {
        this.complete();
    }
}
