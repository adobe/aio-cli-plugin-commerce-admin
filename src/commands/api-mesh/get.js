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

const { Command } = require('@oclif/core');
const { writeFile } = require('fs/promises');

const logger = require('../../classes/logger');
const { initSdk, initRequestId } = require('../../helpers');
const { ignoreCacheFlag, jsonFlag } = require('../../utils');
const { getMeshId, getMesh } = require('../../lib/devConsole');
const { buildMeshUrl } = require('../../urlBuilder');

require('dotenv').config();
class GetCommand extends Command {
	static args = [{ name: 'file' }];
	static flags = {
		ignoreCache: ignoreCacheFlag,
		json: jsonFlag,
	};

	static enableJsonFlag = true;

	async run() {
		await initRequestId();

		logger.info(`RequestId: ${global.requestId}`);

		const { args, flags } = await this.parse(GetCommand);

		const ignoreCache = await flags.ignoreCache;
		const json = await flags.json;

		const { imsOrgId, imsOrgCode, projectId, workspaceId, workspaceName } = await initSdk({
			ignoreCache,
			verbose: !json,
		});

		let meshId = null;

		try {
			meshId = await getMeshId(imsOrgCode, projectId, workspaceId, workspaceName);
		} catch (err) {
			this.error(
				`Unable to get mesh ID. Check the details and try again. RequestId: ${global.requestId}`,
			);
		}

		if (meshId) {
			try {
				const mesh = await getMesh(imsOrgCode, projectId, workspaceId, workspaceName, meshId);

				if (mesh) {
					this.log('Successfully retrieved mesh %s', JSON.stringify(mesh, null, 2));

					const meshUrl = buildMeshUrl(meshId, workspaceName);

					if (args.file) {
						try {
							const { meshConfig } = mesh;
							await writeFile(args.file, JSON.stringify({ meshConfig }, null, 2));

							this.log('Successfully wrote mesh to file %s', args.file);
						} catch (error) {
							this.log('Unable to write mesh to file %s', args.file);

							logger.error(error);
						}
					}

					return { ...mesh, meshUrl, imsOrgId, projectId, workspaceId, workspaceName };
				} else {
					logger.error(
						`Unable to get mesh with the ID ${meshId}. Check the mesh ID and try again. RequestId: ${global.requestId}`,
						{ exit: false },
					);
				}
			} catch (error) {
				this.log(error.message);

				this.error(
					`Unable to get mesh. Check the details and try again. If the error persists please contact support. RequestId: ${global.requestId}`,
				);
			}
		} else {
			this.error(
				`Unable to get mesh config. No mesh found for Org(${imsOrgCode}) -> Project(${projectId}) -> Workspace(${workspaceId}). Please check the details and try again.`,
				{ exit: false },
			);
		}
	}
}

GetCommand.description = 'Get the config of a given mesh';

module.exports = GetCommand;
