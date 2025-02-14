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

const logger = require('../../classes/logger');
const { initSdk, initRequestId, promptConfirm } = require('../../helpers');
const { ignoreCacheFlag, autoConfirmActionFlag } = require('../../utils');
const { getMeshId, deleteMesh } = require('../../lib/devConsole');

require('dotenv').config();

class DeleteCommand extends Command {
	static flags = {
		ignoreCache: ignoreCacheFlag,
		autoConfirmAction: autoConfirmActionFlag,
	};

	async run() {
		await initRequestId();

		logger.info(`RequestId: ${global.requestId}`);

		const { flags } = await this.parse(DeleteCommand);

		const ignoreCache = await flags.ignoreCache;
		const autoConfirmAction = await flags.autoConfirmAction;

		const { imsOrgCode, projectId, workspaceId } = await initSdk({
			ignoreCache,
		});

		let meshId = null;

		try {
			meshId = await getMeshId(imsOrgCode, projectId, workspaceId);
		} catch (err) {
			this.error(
				`Unable to get mesh ID. Please check the details and try again. RequestId: ${global.requestId}`,
			);
		}

		if (meshId) {
			let shouldContinue = true;

			if (!autoConfirmAction) {
				shouldContinue = await promptConfirm(
					`Are you sure you want to delete the mesh: ${meshId}?`,
				);
			}

			if (shouldContinue) {
				try {
					const deleteMeshResponse = await deleteMesh(imsOrgCode, projectId, workspaceId, meshId);

					if (deleteMeshResponse) {
						this.log('Successfully deleted mesh %s', meshId);

						return deleteMeshResponse;
					} else {
						throw new Error('Unable to delete mesh');
					}
				} catch (error) {
					this.log(error.message);

					this.error(
						`Unable to delete mesh. Check the details and try again. If the error persists please contact support. RequestId: ${global.requestId}`,
					);
				}
			} else {
				this.log('Delete cancelled');

				return 'Delete cancelled';
			}
		} else {
			this.error(
				`Unable to delete mesh. No mesh found for Org(${imsOrgCode}) -> Project(${projectId}) -> Workspace(${workspaceId}). Check the details and try again.`,
			);
		}
	}
}

DeleteCommand.description = 'Delete the config of a given mesh';

module.exports = DeleteCommand;
