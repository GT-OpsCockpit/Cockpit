"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.calledWithFn = void 0;
const Matchers_1 = require("./Matchers");
const globals_1 = require("@jest/globals");
const lodash_isequal_1 = __importDefault(require("lodash.isequal"));
function isJestAsymmetricMatcher(obj) {
    return !!obj && typeof obj === 'object' && 'asymmetricMatch' in obj && typeof obj.asymmetricMatch === 'function';
}
const checkCalledWith = (calledWithStack, actualArgs, fallbackMockImplementation) => {
    const calledWithInstance = calledWithStack.find((instance) => instance.args.every((matcher, i) => {
        if (matcher instanceof Matchers_1.Matcher) {
            return matcher.asymmetricMatch(actualArgs[i]);
        }
        if (isJestAsymmetricMatcher(matcher)) {
            return matcher.asymmetricMatch(actualArgs[i]);
        }
        return (0, lodash_isequal_1.default)(actualArgs[i], matcher);
    }));
    return calledWithInstance
        ? calledWithInstance.calledWithFn(...actualArgs)
        : fallbackMockImplementation && fallbackMockImplementation(...actualArgs);
};
const calledWithFn = ({ fallbackMockImplementation, } = {}) => {
    const fn = globals_1.jest.fn(fallbackMockImplementation);
    let calledWithStack = [];
    fn.calledWith = (...args) => {
        // We create new function to delegate any interactions (mockReturnValue etc.) to for this set of args.
        // If that set of args is matched, we just call that jest.fn() for the result.
        const calledWithFn = globals_1.jest.fn(fallbackMockImplementation);
        const mockImplementation = fn.getMockImplementation();
        if (!mockImplementation || mockImplementation === fallbackMockImplementation) {
            // Our original function gets a mock implementation which handles the matching
            // @ts-expect-error '(...args: any) => ReturnType<T>' is assignable to the constraint of type 'T', but 'T' could be instantiated with a different subtype of constraint 'FunctionLike'.
            fn.mockImplementation((...args) => checkCalledWith(calledWithStack, args, fallbackMockImplementation));
            calledWithStack = [];
        }
        calledWithStack.unshift({ args, calledWithFn });
        return calledWithFn;
    };
    return fn;
};
exports.calledWithFn = calledWithFn;
exports.default = exports.calledWithFn;
