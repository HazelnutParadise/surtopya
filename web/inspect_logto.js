const logto = require('@logto/next/server-actions');
console.log('Exports from @logto/next/server-actions:', logto);

try {
    const logtoNext = require('@logto/next');
    console.log('Exports from @logto/next:', logtoNext);
} catch (e) {
    console.log('Could not require @logto/next');
}
