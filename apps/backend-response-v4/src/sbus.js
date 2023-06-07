import { ServiceBusClient } from '@azure/service-bus';
import * as Sentry from '@sentry/node';
let serviceBus;
function getServiceBus() {
    if (!serviceBus) {
        try {
            serviceBus = new ServiceBusClient(process.env.SERVICE_BUS_CONNECTION_STRING);
        }
        catch (e) {
            Sentry.captureException(e);
        }
    }
    return serviceBus;
}
export default getServiceBus;
