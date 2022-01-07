![Logo](admin/samsung.png)
### ioBroker.samsung

![Number of Installations](http://iobroker.live/badges/samsung-installed.svg) ![Number of Installations](http://iobroker.live/badges/samsung-stable.svg) [![NPM version](http://img.shields.io/npm/v/iobroker.samsung.svg)](https://www.npmjs.com/package/iobroker.samsung)
[![Tests](http://img.shields.io/travis/iobroker-community-adapters/ioBroker.samsung/master.svg)](https://travis-ci.org/iobroker-community-adapters/ioBroker.samsung)
[![Build status](https://ci.appveyor.com/api/projects/status/7ggeh5c3b1mcgoe9?svg=true)](https://ci.appveyor.com/project/iobroker-community-adapters/iobroker-samsung-3vcui)
[![License](https://img.shields.io/badge/license-MIT-blue.svg?style=flat)](https://github.com/iobroker-community-adapters/iobroker.samsung/blob/master/LICENSE)

<!--[![Node](https://img.shields.io/badge/node-%3E=4.4-red.svg?style=flat-square)](https://www.npmjs.com/packages/iobroker-community-adapters)-->

#### Description

Adapter for Samsung TVs

### Initial Creation
This adapter was initialy created by @soef at https://github.com/soef/ioBroker.samsung but not maintained any more, so we moved it to iobroker-community so that bugs could be fixed. thanks @soef for his work.
Adapter was extended by jogibear9988 and mwp007 with further Api since then.

#### Configuration
Enter the IP of your Samsung TV.
Choose your API:
	Samsung Remote - TVs before 2014
		After installation, you have to confirm the new connection on your TV
	Samsung HJ - 2014 and 2015
		After first connect you need to enter the Pin shown on your TV.
	Samsung2016 - selfexplaining 
	SamsungTV - Tizen TVs after 2016 



#### Installation
via ioBroker Admin.

Otherweise execute the following command in the iobroker root directory (e.g. in /opt/iobroker)
```
iobroker install samsung
```
or
```
npm install iobroker.samsung 
```

#### Requirements
Samsung TV<br>
HJ Series tested by me on UE55HU7200. 
Support for devices since 2016  experimental
if something does not work, look  in the log.






