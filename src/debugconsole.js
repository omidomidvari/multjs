var __spreadArray = (this && this.__spreadArray) || function (to, from, pack) {
    if (pack || arguments.length === 2) for (var i = 0, l = from.length, ar; i < l; i++) {
        if (ar || !(i in from)) {
            if (!ar) ar = Array.prototype.slice.call(from, 0, i);
            ar[i] = from[i];
        }
    }
    return to.concat(ar || Array.prototype.slice.call(from));
};
// Enable debug mode flag
var DEBUG_MODE = true;
// Simple debug logger
function debugLog(message) {
    var optionalParams = [];
    for (var _i = 1; _i < arguments.length; _i++) {
        optionalParams[_i - 1] = arguments[_i];
    }
    if (DEBUG_MODE) {
        var timestamp = new Date().toISOString();
        console.log.apply(console, __spreadArray(["[DEBUG ".concat(timestamp, "] ").concat(message)], optionalParams, false));
    }
}
// Example usage
debugLog("Debug console initialized.");
debugLog("started looking for .yml workflows in /.workflows/noderuntime/");
// Simulate some process
function processData(data) {
    debugLog("DEBUG:good", data);
    var result = data.reduce(function (sum, val) { return sum + val; }, 0);
    debugLog("Processing complete. Result:", result);
    return result;
}
processData([0]);
