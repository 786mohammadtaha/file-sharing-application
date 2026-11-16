const express = require("express");
const QRCode = require("qrcode");
const fs = require("fs");
const path = require("path");
const os = require("os");
const crypto = require("crypto");
const dgram = require("dgram");

const app = express();

const PORT = 3000;
const UPLOAD_DIRECTORY = path.join(__dirname, "uploads");
const MAX_FILES = 10;
const POLL_TIMEOUT = 30000;

const token = crypto.randomBytes(16).toString("hex");
const waitingRequests = new Set();

let fileQueue = [];
let queueVersion = 0;

// function getLocalIpAddress() {
//     const networkInterfaces = os.networkInterfaces();

//     for (const interfaceList of Object.values(networkInterfaces)) {
//         for (const network of interfaceList || []) {
//             if (network.family === "IPv4" && !network.internal) {
//                 return network.address;
//             }
//         }
//     }

//     return "127.0.0.1";
// }

function getLocalIpAddress() {
    return new Promise((resolve, reject) => {
        const socket = dgram.createSocket("udp4");

        socket.once("error", (error) => {
            socket.close();
            reject(error);
        });

        socket.connect(80, "8.8.8.8", () => {
            const { address } = socket.address();

            socket.close();
            resolve(address);
        });
    });
}

function getSafeFileName(fileName) {
    const baseName = path.basename(fileName || "file");
    return baseName.replace(/[<>:"/\\|?*\x00-\x1F]/g, "_");
}

function getStoredFilePath(file) {
    return path.join(UPLOAD_DIRECTORY, file.storedName);
}

function getPublicFileDetails(file) {
    return {
        id: file.id,
        name: file.name,
        time: file.time,
        date: file.date
    };
}

function notifyQueueChanged() {
    queueVersion++;

    for (const finishRequest of waitingRequests) {
        finishRequest();
    }

    waitingRequests.clear();
}

function loadExistingFiles() {
    const storedNames = fs.readdirSync(UPLOAD_DIRECTORY);

    const files = storedNames
        .map((storedName) => {
            const separatorIndex = storedName.indexOf("__");

            if (separatorIndex === -1) {
                return null;
            }

            const id = storedName.slice(0, separatorIndex);
            const name = storedName.slice(separatorIndex + 2);
            const filePath = path.join(UPLOAD_DIRECTORY, storedName);

            try {
                const stats = fs.statSync(filePath);

                if (!stats.isFile()) {
                    return null;
                }

                return {
                    id,
                    name,
                    storedName,
                    time: stats.mtime.toLocaleTimeString(),
                    date: stats.mtime.toLocaleDateString()
                };
            } catch {
                return null;
            }
        })
        .filter(Boolean)
        .sort((first, second) => {
            return fs.statSync(getStoredFilePath(first)).mtimeMs -
                fs.statSync(getStoredFilePath(second)).mtimeMs;
        });

    fileQueue = files.slice(-MAX_FILES);

    const filesToRemove = files.slice(0, -MAX_FILES);

    for (const file of filesToRemove) {
        fs.unlinkSync(getStoredFilePath(file));
    }
}

function findFile(fileId) {
    return fileQueue.find((file) => file.id === fileId);
}

function sendQueueResponse(response) {
    response.json({
        version: queueVersion,
        files: fileQueue.map(getPublicFileDetails)
    });
}

function waitForQueueChange(request, response) {
    const requestedVersion = Number(request.query.version || -1);

    if (requestedVersion !== queueVersion) {
        sendQueueResponse(response);
        return;
    }

    let timeout;

    function finishRequest() {
        clearTimeout(timeout);
        waitingRequests.delete(finishRequest);

        if (!response.headersSent) {
            sendQueueResponse(response);
        }
    }

    waitingRequests.add(finishRequest);

    timeout = setTimeout(finishRequest, POLL_TIMEOUT);

    response.on("close", () => {
        clearTimeout(timeout);
        waitingRequests.delete(finishRequest);
    });
}

function addUploadedFile(request, response) {
    const fileName = getSafeFileName(
        decodeURIComponent(request.get("X-File-Name") || "file")
    );

    if (!Buffer.isBuffer(request.body) || request.body.length === 0) {
        response.status(400).json({
            success: false,
            message: "No file was received."
        });
        return;
    }

    if (fileQueue.length >= MAX_FILES) {
        response.status(409).json({
            success: false,
            message: "The queue is full. Delete a file before uploading another."
        });
        return;
    }

    const fileId = crypto.randomUUID();
    const storedName = `${fileId}__${fileName}`;
    const filePath = path.join(UPLOAD_DIRECTORY, storedName);

    fs.writeFileSync(filePath, request.body);

    const now = new Date();

    const file = {
        id: fileId,
        name: fileName,
        storedName,
        time: now.toLocaleTimeString(),
        date: now.toLocaleDateString()
    };

    fileQueue.push(file);
    notifyQueueChanged();

    response.status(201).json({
        success: true,
        message: "File uploaded successfully.",
        file: getPublicFileDetails(file)
    });
}

function deleteFile(request, response) {
    const file = findFile(request.params.id);

    if (!file) {
        response.status(404).json({
            success: false,
            message: "File not found."
        });
        return;
    }

    fs.unlinkSync(getStoredFilePath(file));
    fileQueue = fileQueue.filter((queuedFile) => {
        return queuedFile.id !== file.id;
    });

    notifyQueueChanged();

    response.json({
        success: true,
        message: "File deleted successfully."
    });
}

function downloadFile(request, response) {
    const file = findFile(request.params.id);

    if (!file) {
        response.status(404).send("File not found.");
        return;
    }

    response.download(
        getStoredFilePath(file),
        file.name
    );
}

function isLocalRequest(request) {
    const address = request.socket.remoteAddress || "";

    return address === "127.0.0.1" ||
        address === "::1" ||
        address === "::ffff:127.0.0.1";
}

function serveDashboard(request, response) {
    const dashboardFile = isLocalRequest(request)
        ? "computer.html"
        : "phone.html";

    response.sendFile(path.join(__dirname, dashboardFile));
}

function registerRoutes() {
    app.get("/", (request, response) => {
        response.redirect(`/${token}`);
    });

    app.get(`/${token}`, serveDashboard);

    // app.get(`/${token}/qr`, async (request, response) => {
    //     const localIpAddress = getLocalIpAddress();
    //     const phoneUrl = `http://${localIpAddress}:${PORT}/${token}`;

    //     try {
    //         const qrCode = await QRCode.toBuffer(phoneUrl, {
    //             type: "png"
    //         });

    //         response.type("png").send(qrCode);
    //     } catch {
    //         response.status(500).send("Could not generate QR code.");
    //     }
    // });

    app.get(`/${token}/qr`, async (request, response) => {
        const localIpAddress = await getLocalIpAddress();
    
        const phoneUrl = `http://${localIpAddress}:${PORT}/${token}`;
    
        try {
            const qrCode = await QRCode.toBuffer(phoneUrl, {
                type: "png"
            });
    
            response.type("png").send(qrCode);
        } catch {
            response.status(500).send("Could not generate QR code.");
        }
    });

    const uploadParser = express.raw({
        type: "application/octet-stream",
        limit: "1gb"
    });

    app.post(
        `/${token}/api/files/phone`,
        uploadParser,
        addUploadedFile
    );

    app.post(
        `/${token}/api/files/pc`,
        uploadParser,
        addUploadedFile
    );

    app.post(
        `/${token}/api/files/`,
        uploadParser,
        addUploadedFile
    );

    app.get(
        `/${token}/api/files/poll/phone`,
        waitForQueueChange
    );

    app.get(
        `/${token}/api/files/poll/pc`,
        waitForQueueChange
    );

    app.get(
        `/${token}/api/files/poll/`,
        waitForQueueChange
    );

    app.get(
        `/${token}/api/files/:id/download`,
        downloadFile
    );

    app.delete(
        `/${token}/api/files/:id`,
        deleteFile
    );
}

// function startServer() {
//     if (!fs.existsSync(UPLOAD_DIRECTORY)) {
//         fs.mkdirSync(UPLOAD_DIRECTORY, {
//             recursive: true
//         });
//     }

//     loadExistingFiles();
//     registerRoutes();

//     const localIpAddress = getLocalIpAddress();

//     app.listen(PORT, "0.0.0.0", () => {
//         console.log(`Computer dashboard: http://localhost:${PORT}/`);
//         console.log(`Phone dashboard: http://${localIpAddress}:${PORT}/${token}`);
//         console.log(`Shared token: ${token}`);
//     });
// }

async function startServer() {
    if (!fs.existsSync(UPLOAD_DIRECTORY)) {
        fs.mkdirSync(UPLOAD_DIRECTORY, {
            recursive: true
        });
    }

    loadExistingFiles();
    registerRoutes();

    const localIpAddress = await getLocalIpAddress();

    app.listen(PORT, "0.0.0.0", () => {
        console.log(`Computer dashboard: http://localhost:${PORT}/`);
        console.log(`Phone dashboard: http://${localIpAddress}:${PORT}/${token}`);
        console.log(`Shared token: ${token}`);
    });
}

startServer();
