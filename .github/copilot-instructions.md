# ioBroker Adapter Development with GitHub Copilot

**Version:** 0.4.0
**Template Source:** https://github.com/DrozmotiX/ioBroker-Copilot-Instructions

This file contains instructions and best practices for GitHub Copilot when working on ioBroker adapter development.

## Project Context

You are working on an ioBroker adapter. ioBroker is an integration platform for the Internet of Things, focused on building smart home and industrial IoT solutions. Adapters are plugins that connect ioBroker to external systems, devices, or services.

### Samsung TV Adapter Context
This is the **Samsung TV adapter** for ioBroker, designed to control and monitor Samsung television devices. The adapter supports multiple Samsung TV API versions and connection methods:

#### Supported Samsung TV APIs
- **SamsungRemote**: Legacy TVs before 2014 (requires TV confirmation after installation)
- **SamsungHJ**: 2014 and 2015 H and J Series TVs (requires PIN entry from TV display)
- **Samsung2016**: Self-explanatory 2016 models
- **SamsungTV**: Modern Tizen TVs after 2016 (requires token authentication)

#### Key Features
- Remote control key simulation (power, volume, channel, navigation)
- Wake-on-LAN support for network wake-up
- Multi-API support for different TV generations
- Token-based authentication for modern TVs
- Connection status monitoring and error handling

#### Configuration Requirements
- **IP Address**: Samsung TV network IP (required for all APIs)
- **MAC Address**: Required only for SamsungTV API and Wake-on-LAN
- **Token**: Authentication token for SamsungTV API (auto-generated on first connect)
- **PIN**: Required for SamsungHJ API initial setup (displayed on TV)
- **API Type**: Selection between SamsungRemote, SamsungHJ, Samsung2016, SamsungTV

#### External Dependencies
- `samsung-remote`: npm package for legacy Samsung TV control
- `samsungtv`: Git package for modern Samsung TV API integration  
- `ws`: WebSocket support for real-time communication
- `node-fetch`: HTTP client for API communication

#### Development Considerations
- Handle different connection states (online/offline/error)
- Implement proper error recovery for network timeouts
- Support dynamic API switching based on TV model detection
- Manage authentication tokens and PIN workflows
- Test with mock TV responses since physical TVs may not be available

## Testing

### Unit Testing
- Use Jest as the primary testing framework for ioBroker adapters
- Create tests for all adapter main functions and helper methods
- Test error handling scenarios and edge cases
- Mock external API calls and hardware dependencies
- For adapters connecting to APIs/devices not reachable by internet, provide example data files to allow testing of functionality without live connections
- Example test structure:
  ```javascript
  describe('AdapterName', () => {
    let adapter;
    
    beforeEach(() => {
      // Setup test adapter instance
    });
    
    test('should initialize correctly', () => {
      // Test adapter initialization
    });
  });
  ```

### Integration Testing

**IMPORTANT**: Use the official `@iobroker/testing` framework for all integration tests. This is the ONLY correct way to test ioBroker adapters.

**Official Documentation**: https://github.com/ioBroker/testing

#### Framework Structure
Integration tests MUST follow this exact pattern:

```javascript
const path = require('path');
const { tests } = require('@iobroker/testing');

// Define test coordinates or configuration
const TEST_COORDINATES = '52.520008,13.404954'; // Berlin
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));

// Use tests.integration() with defineAdditionalTests
tests.integration(path.join(__dirname, '..'), {
    defineAdditionalTests({ suite }) {
        suite('Test adapter with specific configuration', (getHarness) => {
            let harness;

            before(() => {
                harness = getHarness();
            });

            it('should configure and start adapter', function () {
                return new Promise(async (resolve, reject) => {
                    try {
                        harness = getHarness();
                        
                        // Get adapter object using promisified pattern
                        const obj = await new Promise((res, rej) => {
                            harness.objects.getObject('system.adapter.your-adapter.0', (err, o) => {
                                if (err) return rej(err);
                                res(o);
                            });
                        });
                        
                        if (!obj) {
                            return reject(new Error('Adapter object not found'));
                        }

                        // Configure adapter properties
                        Object.assign(obj.native, {
                            position: TEST_COORDINATES,
                            createCurrently: true,
                            createHourly: true,
                            createDaily: true,
                            // Add other configuration as needed
                        });

                        // Set object and start adapter
                        await new Promise((res, rej) => {
                            harness.objects.setObject(obj._id, obj, (err) => {
                                if (err) return rej(err);
                                res(undefined);
                            });
                        });

                        await harness.startAdapterAndWait();
                        
                        // Allow time for states to be created
                        await wait(5000);
                        
                        // Validate expected states exist
                        const stateIds = await harness.dbConnection.getStateIDs('your-adapter.0.*');
                        console.log(`Created ${stateIds.length} states`);
                        
                        await harness.stopAdapter();
                        resolve();
                    } catch (error) {
                        reject(error);
                    }
                });
            });
        });
    }
});
```

#### Real Integration Test Example
For detailed implementation, see complete working example:

```javascript
describe('Advanced Integration Testing', () => {
    before(function () {
        this.timeout(30000);
    });

    it('should configure and test adapter functionality', function () {
        return new Promise(async (resolve, reject) => {
            try {
                console.log('🔍 Step 1: Getting test harness...');
                harness = getHarness();
                
                console.log('🔍 Step 1.5: Loading adapter object...');
                const obj = await new Promise((res, rej) => {
                    harness.objects.getObject('system.adapter.your-adapter.0', (err, o) => {
                        if (err) return rej(err);
                        res(o);
                    });
                });
            
            if (!obj) return reject(new Error('Adapter object not found'));
            console.log('✅ Step 1.5: Adapter object loaded');

            console.log('🔍 Step 2: Updating adapter config...');
            Object.assign(obj.native, {
                position: TEST_COORDINATES,
                createCurrently: false,
                createHourly: true,
                createDaily: false, // Daily disabled for this test
            });

            await new Promise((res, rej) => {
                harness.objects.setObject(obj._id, obj, (err) => {
                    if (err) return rej(err);
                    console.log('✅ Step 2.5: Adapter object updated');
                    res(undefined);
                });
            });

            console.log('🔍 Step 3: Starting adapter...');
            await harness.startAdapterAndWait();
            console.log('✅ Step 4: Adapter started');

            console.log('⏳ Step 5: Waiting 20 seconds for states...');
            await new Promise((res) => setTimeout(res, 20000));

            console.log('🔍 Step 6: Fetching state IDs...');
            const stateIds = await harness.dbConnection.getStateIDs('your-adapter.0.*');

            console.log(`📊 Step 7: Found ${stateIds.length} total states`);

            const hourlyStates = stateIds.filter((key) => key.includes('hourly'));
            if (hourlyStates.length > 0) {
                console.log(`✅ Step 8: Correctly ${hourlyStates.length} hourly weather states created`);
            } else {
                console.log('❌ Step 8: No hourly states created (test failed)');
                return reject(new Error('Expected hourly states but found none'));
            }

            // Check daily states should NOT be present
            const dailyStates = stateIds.filter((key) => key.includes('daily'));
            if (dailyStates.length === 0) {
                console.log(`✅ Step 9: No daily states found as expected`);
            } else {
                console.log(`❌ Step 9: Daily states present (${dailyStates.length}) (test failed)`);
                return reject(new Error('Expected no daily states but found some'));
            }

            await harness.stopAdapter();
            console.log('🛑 Step 10: Adapter stopped');

            resolve(true);
        } catch (error) {
            reject(error);
        }
    });
}).timeout(40000);

// Example: Testing missing required configuration  
it('should handle missing required configuration properly', function () {
    return new Promise(async (resolve, reject) => {
        try {
            harness = getHarness();
            
            console.log('🔍 Step 1: Fetching adapter object...');
            const obj = await new Promise((res, rej) => {
                harness.objects.getObject('system.adapter.your-adapter.0', (err, o) => {
                    if (err) return rej(err);
                    res(o);
                });
            });
            
            if (!obj) return reject(new Error('Adapter object not found'));

            console.log('🔍 Step 2: Removing required configuration...');
            // Remove required configuration to test failure handling
            delete obj.native.position; // This should cause failure or graceful handling

            await new Promise((res, rej) => {
                harness.objects.setObject(obj._id, obj, (err) => {
                    if (err) return rej(err);
                    res(undefined);
                });
            });

            console.log('🔍 Step 3: Starting adapter (should handle missing config gracefully)...');
            await harness.startAdapterAndWait();

            await new Promise((res) => setTimeout(res, 5000));

            // Check if adapter handled missing config appropriately
            const stateIds = await harness.dbConnection.getStateIDs('your-adapter.0.*');
            
            // Adapter should either:
            // 1. Create a warning/error state
            // 2. Log appropriate error messages 
            // 3. Not crash but handle gracefully
            
            console.log(`✅ Adapter handled missing config gracefully, created ${stateIds.length} states`);

            await harness.stopAdapter();
            resolve(true);
        } catch (error) {
            // Expected behavior - test passes if adapter properly rejects bad config
            console.log('✅ Adapter properly rejected invalid configuration');
            resolve(true);
        }
    });
}).timeout(15000);
```

#### Test Data Management
For adapters with external API dependencies:
- Create mock JSON responses in `test/data/` directory
- Use example device configurations for different scenarios
- Simulate API responses for consistent testing

### Continuous Integration
- Use GitHub Actions for automated testing
- Test across multiple Node.js versions (18+)
- Include linting with ESLint
- Run both unit tests and integration tests
- Generate test coverage reports

## Code Style & Linting

### ESLint Configuration
Follow the standard ioBroker ESLint configuration:

```json
{
  "extends": "@iobroker/adapter-dev",
  "rules": {
    "no-var": "error",
    "prefer-const": "error",
    "semi": ["error", "always"],
    "quotes": ["error", "single"]
  }
}
```

### Formatting Standards
- Use 4-space indentation
- Semicolons are required
- Single quotes for strings
- Consistent spacing around operators
- Use `const` for unchanging values, `let` for variables
- Avoid `var` declarations

## Error Handling

### Adapter Lifecycle Error Handling
Implement proper error handling throughout the adapter lifecycle:

```javascript
class MyAdapter extends utils.Adapter {
    constructor(options) {
        super(options);
        this.on('ready', this.onReady.bind(this));
        this.on('unload', this.onUnload.bind(this));
    }

    async onReady() {
        try {
            // Adapter initialization logic
            await this.initializeAdapter();
        } catch (error) {
            this.log.error(`Failed to initialize adapter: ${error.message}`);
            this.terminate ? this.terminate() : process.exit();
        }
    }

    onUnload(callback) {
        try {
            // Clean up resources
            this.cleanup();
            callback();
        } catch (error) {
            this.log.error(`Error during cleanup: ${error.message}`);
            callback();
        }
    }
}
```

### Network and API Error Handling
Implement robust error handling for external communications:

```javascript
async function callExternalAPI(url) {
    try {
        const response = await fetch(url, {
            timeout: 10000,
            headers: { 'User-Agent': 'ioBroker-Adapter' }
        });
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        return await response.json();
    } catch (error) {
        if (error.name === 'AbortError') {
            throw new Error('Request timeout');
        } else if (error.code === 'ENOTFOUND') {
            throw new Error('Network unreachable');
        }
        throw error;
    }
}
```

### Graceful Degradation
Design adapters to handle failures gracefully:
- Continue operation when non-critical features fail
- Provide meaningful error messages to users
- Implement retry mechanisms with exponential backoff
- Cache data when possible to survive temporary outages

## State Management

### State Creation and Naming
Follow ioBroker naming conventions for states:

```javascript
// Good state naming
await this.setObjectNotExistsAsync('device.power', {
    type: 'state',
    common: {
        name: 'Power State',
        type: 'boolean',
        role: 'switch.power',
        read: true,
        write: true,
    },
    native: {},
});

// Channel organization
await this.setObjectNotExistsAsync('device', {
    type: 'channel',
    common: {
        name: 'Device Controls'
    },
    native: {}
});
```

### State Update Best Practices
- Use `setStateAsync()` with appropriate acknowledge flag
- Check for state changes before updating to avoid loops
- Use proper data types (boolean, number, string)
- Include meaningful state names and descriptions

### State Roles
Use appropriate state roles for better ioBroker integration:
- `switch.power` - Power on/off controls
- `media.volume` - Volume controls  
- `media.mute` - Mute toggle
- `info.status` - Status information
- `button` - Action buttons

## Configuration Management

### Admin Configuration
Create intuitive configuration interfaces:

```javascript
// io-package.json configuration schema
"native": {
    "ip": "",
    "port": 8080,
    "username": "",
    "password": "",
    "pollInterval": 30000
}
```

### Configuration Validation
Always validate user configuration:

```javascript
validateConfig(config) {
    const errors = [];
    
    if (!config.ip || !this.isValidIP(config.ip)) {
        errors.push('Invalid IP address');
    }
    
    if (config.port < 1 || config.port > 65535) {
        errors.push('Port must be between 1 and 65535');
    }
    
    return errors;
}
```

### Secure Credential Handling
- Use `common.type: 'password'` for sensitive fields
- Never log passwords or tokens
- Encrypt sensitive data when storing

## Logging Best Practices

### Log Levels
Use appropriate log levels:
- `error`: Critical errors that affect functionality
- `warn`: Important issues that don't break functionality  
- `info`: General operational information
- `debug`: Detailed diagnostic information

### Structured Logging
Provide context in log messages:

```javascript
// Good logging examples
this.log.info(`Connected to device at ${config.ip}:${config.port}`);
this.log.warn(`Retrying connection (attempt ${retryCount}/${maxRetries})`);
this.log.error(`API call failed: ${error.message}`, error);
this.log.debug(`Received response: ${JSON.stringify(response)}`);
```

## Documentation

### README Structure
Maintain comprehensive README.md with:
- Clear adapter description and purpose
- Supported devices/services
- Installation instructions
- Configuration guide with examples
- Changelog with version history
- License information

### Code Documentation
- Use JSDoc for function documentation
- Include parameter types and descriptions
- Document complex algorithms and business logic
- Provide usage examples for public methods

### Change Documentation

#### Changelog Formatting Standards
Use this standard format for all changelog entries:

- Use format: `* (author) **TYPE**: Description of user-visible change`
- Types: **NEW** (features), **FIXED** (bugs), **ENHANCED** (improvements), **TESTING** (test additions), **CI/CD** (automation)
- Focus on user impact, not technical implementation details
- Example: `* (DutchmanNL) **FIXED**: Adapter now properly validates login credentials instead of always showing "credentials missing"`

### Documentation Workflow Standards
- **Mandatory README updates**: Establish requirement to update README.md for every PR/feature
- **Standardized documentation**: Create consistent format and categories for changelog entries
- **Enhanced development workflow**: Integrate documentation requirements into standard development process

### Changelog Management with AlCalzone Release-Script
Follow the [AlCalzone release-script](https://github.com/AlCalzone/release-script) standard for changelog management:

#### Format Requirements
- Always use `## **WORK IN PROGRESS**` as the placeholder for new changes
- Add all PR/commit changes under this section until ready for release
- Never modify version numbers manually - only when merging to main branch
- Maintain this format in README.md or CHANGELOG.md:

```markdown
# Changelog

<!--
  Placeholder for the next version (at the beginning of the line):
  ## **WORK IN PROGRESS**
-->

## **WORK IN PROGRESS**

-   Did some changes
-   Did some more changes

## v0.1.0 (2023-01-01)
Initial release
```

#### Workflow Process
- **During Development**: All changes go under `## **WORK IN PROGRESS**`
- **For Every PR**: Add user-facing changes to the WORK IN PROGRESS section
- **Before Merge**: Version number and date are only added when merging to main
- **Release Process**: The release-script automatically converts the placeholder to the actual version

#### Change Entry Format
Use this consistent format for changelog entries:
- `- (author) **TYPE**: User-friendly description of the change`
- Types: **NEW** (features), **FIXED** (bugs), **ENHANCED** (improvements)
- Focus on user impact, not technical implementation details
- Reference related issues: "fixes #XX" or "solves #XX"

#### Example Entry
```markdown
## **WORK IN PROGRESS**

- (DutchmanNL) **FIXED**: Adapter now properly validates login credentials instead of always showing "credentials missing" (fixes #25)
- (DutchmanNL) **NEW**: Added support for device discovery to simplify initial setup
```

## Dependency Updates

### Package Management
- Always use `npm` for dependency management in ioBroker adapters
- Keep dependencies minimal and focused
- Regularly update dependencies to latest stable versions
- Use `npm audit` to check for security vulnerabilities
- Before committing, ensure package.json and package-lock.json are in sync by running `npm install`

### Dependency Best Practices
- Prefer built-in Node.js modules when possible
- Use `@iobroker/adapter-core` for adapter base functionality
- Avoid deprecated packages
- Document any specific version requirements

## JSON-Config Admin Instructions

### Configuration Schema
When creating admin configuration interfaces:

- Use JSON-Config format for modern ioBroker admin interfaces
- Provide clear labels and help text for all configuration options
- Include input validation and error messages
- Group related settings logically

### Form Elements
Common JSON-Config patterns for adapter settings:

```json
{
  "type": "tabs",
  "items": {
    "general": {
      "type": "panel",
      "label": "General Settings",
      "items": {
        "ip": {
          "type": "ip",
          "label": "IP Address",
          "tooltip": "The IP address of the target device"
        },
        "port": {
          "type": "number",
          "label": "Port",
          "min": 1,
          "max": 65535
        }
      }
    }
  }
}
```

## Version Control Best Practices

### Git Workflow
- Use descriptive commit messages
- Create feature branches for new development
- Submit pull requests for code review
- Tag releases appropriately
- Maintain clean commit history

### Branch Management
- `main` branch for stable releases
- `develop` branch for ongoing development  
- Feature branches: `feature/description`
- Hotfix branches: `hotfix/issue-description`

## Performance Optimization

### Efficient State Updates
- Batch state updates when possible
- Use appropriate polling intervals
- Implement caching for expensive operations
- Consider rate limiting for API calls

### Memory Management  
- Clean up event listeners in `onUnload()`
- Clear timeouts and intervals
- Dispose of external connections properly
- Monitor memory usage in long-running operations

## Security Considerations

### Input Validation
Always validate and sanitize user inputs:

```javascript
function validateInput(input) {
    // Sanitize string inputs
    if (typeof input === 'string') {
        return input.trim().substring(0, 255);
    }
    return input;
}
```

### Secure Communication
- Use HTTPS/WSS when available
- Validate SSL certificates
- Implement proper authentication
- Store credentials securely

## Adapter Core Integration

### Using @iobroker/adapter-core
Modern adapters should extend the official adapter core:

```javascript
const utils = require('@iobroker/adapter-core');

class MyAdapter extends utils.Adapter {
    constructor(options) {
        super({
            ...options,
            name: 'my-adapter',
        });
        
        this.on('ready', this.onReady.bind(this));
        this.on('stateChange', this.onStateChange.bind(this));
        this.on('unload', this.onUnload.bind(this));
    }

    async onReady() {
        // Initialize adapter
        this.subscribeStates('*');
    }

    onStateChange(id, state) {
        if (state && !state.ack) {
            // Handle state changes from user
        }
    }

    onUnload(callback) {
        // Clean up and call callback
        callback();
    }
}

if (require.main !== module) {
    module.exports = (options) => new MyAdapter(options);
} else {
    new MyAdapter();
}
```

## Device Discovery and Auto-Configuration

### Network Discovery
Implement device discovery when possible:

```javascript
async function discoverDevices() {
    try {
        // Network scanning logic
        const devices = await this.scanNetwork();
        return devices.filter(device => device.type === 'target-device');
    } catch (error) {
        this.log.warn(`Discovery failed: ${error.message}`);
        return [];
    }
}
```

### Auto-Configuration
Provide sensible defaults and auto-detection:
- Detect device capabilities automatically
- Suggest optimal polling intervals
- Auto-configure based on device responses
- Provide configuration wizards for complex setups

## Multi-Language Support

### Translation Management
Support multiple languages using ioBroker's translation system:
- Maintain translation files for admin interface
- Use meaningful translation keys  
- Provide English as fallback language
- Keep translations consistent with ioBroker standards

### Admin Interface Localization
```javascript
// In admin configuration
"label": {
    "en": "IP Address",
    "de": "IP-Adresse", 
    "ru": "IP-адрес"
}
```

This comprehensive guide should help GitHub Copilot provide better, more relevant suggestions for ioBroker adapter development. The focus is on practical patterns, proper error handling, and following established ioBroker community standards.