var exit = process.exit;

process.exit = function () {
    setTimeout(function () {
        exit();
    }, 200);
};

require('../node_modules/mocha/bin/_mocha');