import { Request } from "express";
import { WebSocket } from "ws";
import WebSocketManager from "../../lib/WebSocketManager";
import RFIDManager from "../../RFIDManager";

// Events
import Ping from "./ping";

export default (ws: WebSocket, req: Request) => {
    const wsManager = new WebSocketManager(ws);

    // Register events
    wsManager.listen(Ping);

    // Add socket to manager
    const rfidManager: RFIDManager = req.app.get("rfidManager");
    rfidManager.addWebSocket(wsManager);
};
