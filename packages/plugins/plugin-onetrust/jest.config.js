const baseConfig = require('@ht-sdks/analytics-rn-shared/jest.config.base');

module.exports = {
  ...baseConfig,
  roots: [...baseConfig.roots, '<rootDir>/src']
};
