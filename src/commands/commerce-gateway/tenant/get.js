/*
Copyright 2021 Adobe. All rights reserved.
This file is licensed to you under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License. You may obtain a copy
of the License at http://www.apache.org/licenses/LICENSE-2.0
Unless required by applicable law or agreed to in writing, software distributed under
the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR REPRESENTATIONS
OF ANY KIND, either express or implied. See the License for the specific language
governing permissions and limitations under the License.
*/

const { Command } = require('@oclif/command');
const logger = require('../../../classes/logger');
const { initSdk, initRequestId } = require('../../../helpers');

class GetCommand extends Command {
	static args = [{ name: 'meshId' }];

	async run() {
		await initRequestId();
		logger.info(`RequestId: ${global.requestId}`);
		const { args } = this.parse(GetCommand);
		const { schemaServiceClient, imsOrgCode } = await initSdk();

		/**
		 * Mock data
		 *
		 * To be implemented soon
		 */
		const projectId = 'test-project';
		const workspaceId = 'test-workspace';

		const tenant = await schemaServiceClient.getTenant(
			imsOrgCode,
			projectId,
			workspaceId,
			args.meshId,
		);
		tenant
			? this.log(JSON.stringify(tenant))
			: this.error(`Unable to retrieve the tenant config for ${args.meshId}`);
		return tenant;
	}
}

GetCommand.description = 'Get the config of a given tenant';

module.exports = GetCommand;
