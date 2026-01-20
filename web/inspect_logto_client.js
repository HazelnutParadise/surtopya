const LogtoClient = require('@logto/next/server-actions').default;
console.log('LogtoClient:', LogtoClient);
if (LogtoClient) {
    console.log('Prototype methods:', Object.getOwnPropertyNames(LogtoClient.prototype));
}
