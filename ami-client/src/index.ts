import { AmiEventHandler } from "./AmiEventHandler";

import amiGen, { DeviceState, Action } from "asterisk-manager";
import { DeviceStateChangeEventParser } from "./DeviceStateChangeEventParser";
import { UserEventParser, SMS_RECEIVED_STRING, SmsReceivedUserEvent } from "./UserEventParser";
import { AmiListEndpointsAction } from "./AmiListEndpointsAction";
import { DeviceStateChangeEvent } from "./DeviceStateChangeEvent";
import { AmiMessageSendAction } from "./AmiMessageSendAction";

function requiredEnvVar(varName: string): string {
    const value = process.env[varName];
    if (value) {
        return value;
    }
    else {
        console.error(`Environement variable ${varName} is not defined.`);
        process.exit(1);
    }
}

const amiIpAddress = requiredEnvVar("AMI_IP_ADDRESS");
const amiUsername = requiredEnvVar("AMI_USERNAME");
const amiPassword = requiredEnvVar("AMI_PASSWORD");

const ami = amiGen(
    "5038",
    amiIpAddress,
    amiUsername,
    amiPassword,
    true
);
ami.keepConnected();

const handler = new AmiEventHandler();
ami.on(
    "devicestatechange",
    (e) => {
        try {
            handler.onDeviceStateChange(
                DeviceStateChangeEventParser.parseDeviceStateChangeEvent(e)
            );
        }
        catch (e) {
            console.error(e);
        }
    }
);
ami.on(
    "userevent",
    (e) => {
        try {
            const parsed = UserEventParser.parse(e);
            if (parsed.type === SMS_RECEIVED_STRING) {
                handler.onSmsReceived(parsed as SmsReceivedUserEvent);
            }
        }
        catch (e) {
            console.error(e);
        }
    }
);

// Display message confirming when we are connected to the AMI.
let intervalId: NodeJS.Timeout;
const checkIfConnected = () => {
    if (ami.isConnected()) {
        console.log("Connected to AMI.");
        clearInterval(intervalId);
        handler.setAmiInstance(ami);

        new AmiListEndpointsAction(ami).listEndpoints()
            .then(endpoints => {
                endpoints.forEach(endpoint => {
                    const event: DeviceStateChangeEvent = {state: endpoint.devicestate};
                    handler.onDeviceStateChange(event);
                });
            })
            .catch((err) => console.error(err));
    }
};
intervalId = setInterval(checkIfConnected, 1000);
