/** Unit tests for the pure parts of the widget (filters, exports, totals, header groups). */
module.exports = {
    testEnvironment: "node",
    roots: ["<rootDir>/src"],
    testMatch: ["**/__tests__/**/*.test.ts"],
    setupFiles: ["<rootDir>/src/__tests__/setup.ts"],
    transform: {
        "^.+\\.tsx?$": ["ts-jest", { tsconfig: { jsx: "react-jsx", esModuleInterop: true, module: "commonjs", target: "es2020", strict: true, skipLibCheck: true } }]
    },
    moduleNameMapper: {
        "^mendix/filters/builders$": "<rootDir>/src/__mocks__/mendixFilters.ts"
    }
};
