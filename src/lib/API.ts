import axios, { AxiosInstance } from "axios";

export class ResponseType {
    public static BOOKING_SUCCESS = new ResponseType("BOOKING_SUCCESS");
    public static SUCCESS = new ResponseType("SUCCESS");
    public static RETURN_SUCCESS = new ResponseType("RETURN_SUCCESS");
    public static USER_INFO = new ResponseType("INFO_SUCCESS");
    public static DEVICE_NOT_FOUND = new ResponseType("DEVICE_NOT_FOUND", true);
    public static WRONG_DEVICE_TYPE = new ResponseType("DEVICE_TYPE_NOT_FOUND", true);
    public static NOT_ALLOWED_FOR_THIS_CLASS = new ResponseType("NOT_ALLOWED_FOR_THIS_CLASS", true);
    public static NOT_ALLOWED_FOR_THIS_DEVICE = new ResponseType("DEVICE_ALREADY_LENT", true);
    public static DEVICE_ALREADY_EXISTS = new ResponseType("DEVICE_ALREADY_EXISTS", true);
    public static TYPE_NOT_FOUND = new ResponseType("TYPE_NOT_FOUND", true); // Fix: This is not used, instead DEVICE_TYPE_NOT_FOUND and USERCARD_TYPE_NOT_FOUND are used!
    public static RETURN_NOT_POSSIBLE = new ResponseType("DEVICE_NOT_LENT", true);
    public static UNEXPECTED_ERROR = new ResponseType("UNEXPECTED_ERROR", true);
    public static REQUIRED_DATA_MISSING = new ResponseType("REQUIRED_DATA_MISSING", true);
    public static AUTHORIZATION_ERROR = new ResponseType("NOT_AUTHORIZED", true);
    public static ACCESS_ERROR = new ResponseType("NOT_ALLOWED", true);

    private static RESPONSE_TYPES = [
        this.BOOKING_SUCCESS,
        this.SUCCESS,
        this.RETURN_SUCCESS,
        this.USER_INFO,
        this.DEVICE_NOT_FOUND,
        this.WRONG_DEVICE_TYPE,
        this.NOT_ALLOWED_FOR_THIS_CLASS,
        this.NOT_ALLOWED_FOR_THIS_DEVICE,
        this.DEVICE_ALREADY_EXISTS,
        this.TYPE_NOT_FOUND,
        this.RETURN_NOT_POSSIBLE,
        this.UNEXPECTED_ERROR,
        this.REQUIRED_DATA_MISSING,
        this.AUTHORIZATION_ERROR,
    ];

    public readonly identifier: string;
    public readonly error: boolean;

    constructor(identifier: string, error = false) {
        this.identifier = identifier;
        this.error = error;
    }

    public static getByIdentifier(id: string) {
        for (const responseType of this.RESPONSE_TYPES) {
            if (responseType.identifier == id) return responseType;
        }
        return null;
    }
}

export class ResponseError extends Error {
    public status: ResponseType;

    constructor(status: ResponseType, message: string) {
        super(message);
        this.status = status;
    }
}

export class DeviceType {
    // TODO: Create device types automatically from database (GET api/v5/device/type)
    public static readonly IPad = new DeviceType("Ipad", 1);
    public static readonly UserCard = new DeviceType("UserCard", 2);
    public static readonly SurfaceBook = new DeviceType("Surface Book", 3);
    public static readonly Laptop = new DeviceType("Laptop", 4);

    public static readonly deviceTypes = [this.IPad, this.UserCard, this.SurfaceBook, this.Laptop];

    public static getByName(name: string): DeviceType {
        for (const deviceType of this.deviceTypes) if (deviceType.name == name) return deviceType;
        return null;
    }

    public static getById(id: number): DeviceType {
        for (const deviceType of this.deviceTypes) if (deviceType.id == id) return deviceType;
        return null;
    }

    public readonly name: string;
    public readonly id: number;

    private constructor(name: string, id: number) {
        this.name = name;
        this.id = id;
    }
}

interface RawBookingResponse {
    status: string;
    message: string;
    data: {
        user?: {
            firstname: string;
            lastname: string;
            user_id: number;
            class: string;
            multi_booking: boolean;
            status: string;
            history?: UserHistoryDevice[];
            devices_amount: {
                currently: number;
                session: number;
                ever: number;
            }
        };
        device?: {
            device_id: number;
            device_type: string;
            status: boolean;
            rfid_code: string;
        };
    };
}

export interface UserHistoryDevice {
    device_id: string;
    begin: string;
    end: string;
    device_type: string;
}

export interface User {
    firstname: string;
    lastname: string;
    user_id: number;
    class: string;
    multi_booking: boolean;
    history?: Array<unknown>;
    devices_amount: {
        currently: number;
        session: number;
        ever: number;
    }
}

export interface Device {
    device_id: number;
    device_type: string;
    status: boolean;
    rfid_code: string;
}

export interface BookingResponse {
    status: ResponseType;
    message: string;
    data: {
        user?: User;
        device?: Device;
    };
}

export interface RegisterDeviceResponse {
    status: ResponseType;
    message: string;
}

export interface CheckTokenResponse {
    status: ResponseType;
    message: string;
    permissions: string[];
}

export default class API {
    private apiUrl: string;
    private apiToken: string;
    private client: AxiosInstance; 

    constructor(apiUrl: string, apiToken: string) {
        this.apiUrl = apiUrl;
        this.apiToken = apiToken;
        this.client = axios.create({
            baseURL: this.apiUrl,
            headers: { Authorization: "Bearer " + this.apiToken },
            responseType: "json",
        });
    }

    public async checkToken(): Promise<CheckTokenResponse> {
        try {
            const data = (await this.client.post("/token/validate")).data;
            return Object.assign(data, { status: ResponseType.getByIdentifier(data.status) });
        } catch (err) {
            this.catchAPIError(err);
        }
    }

    public async registerDevice(uid: string, type: DeviceType): Promise<RegisterDeviceResponse> {
        try {
            const data = (await this.client.post("/device/create", { rfid_code: uid, type: type.id })).data;
            return Object.assign(data, { status: ResponseType.getByIdentifier(data.status) });
        } catch (err) {
            this.catchAPIError(err);
        }
    }

    public async unknownActionForUid(uid: string): Promise<BookingResponse> {
        try {
            return this.parseBookingResponse(
                await this.client.post<RawBookingResponse>("/booking", {
                    uid_1: uid,
                }),
            );
        } catch (err) {
            this.catchAPIError(err);
        }
    }

    public async book(userUid: string, deviceUid: string): Promise<BookingResponse> {
        try {
            return this.parseBookingResponse(
                await this.client.post<RawBookingResponse>("/booking", {
                    uid_1: userUid,
                    uid_2: deviceUid,
                }),
            );
        } catch (err) {
            this.catchAPIError(err);
        }
    }

    private catchAPIError(error: unknown) {
        if (!axios.isAxiosError(error)) {
            console.error("Unrecognized client side-error");
            throw error;
        }
        if (!error.response || !error.response.data.status) {
            console.error("Malformed API error");
            throw error;
        }

        const responseType = ResponseType.getByIdentifier(error.response.data.status);
        if (!responseType) {
            console.error("Unknown API error");
            throw error;
        }
        throw new ResponseError(responseType, error.response.data.message);
    }

    private parseBookingResponse(response: { data: RawBookingResponse }): BookingResponse {
        return Object.assign(response.data, {
            status: ResponseType.getByIdentifier(response.data.status),
        });
    }

    public static isResponseError(error: unknown): error is ResponseError {
        return error instanceof ResponseError;
    }
}
