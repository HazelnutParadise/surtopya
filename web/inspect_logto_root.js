const LogtoClient = require('@logto/next').default;
console.log('LogtoClient:', LogtoClient);
if (LogtoClient) {
    console.log('Prototype methods:', Object.getOwnPropertyNames(LogtoClient.prototype));
} else {
    console.log('Default export is undefined. Full exports:', require('@logto/next'));
}
