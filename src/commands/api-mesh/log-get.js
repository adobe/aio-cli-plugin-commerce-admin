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
const logger = require('../../classes/logger');
const { initSdk, initRequestId } = require('../../helpers');
const { ignoreCacheFlag } = require('../../utils');
const { getMeshId, getLogsByRayId } = require('../../lib/devConsole');
require('dotenv').config();

class FetchLogsCommand extends Command {
	static args = [{ name: 'rayId', required: true, description: 'Fetch a single log by rayID' }];
	static flags = {
		ignoreCache: ignoreCacheFlag,
	};

	async run() {
		await initRequestId();

		logger.info(`RequestId: ${global.requestId}`);

		const { args, flags } = await this.parse(FetchLogsCommand);

		const ignoreCache = flags.ignoreCache;
		const rayId = args.rayId;

		const { imsOrgCode, projectId, workspaceId } = await initSdk({
			ignoreCache,
		});

		let meshId = null;
		try {
			meshId = await getMeshId(imsOrgCode, projectId, workspaceId, meshId);
			if (!meshId) {
				throw new Error('MeshIdNotFound');
			}
		} catch (err) {
			this.error(
				`Unable to get mesh ID. Please check the details and try again. RequestId: ${global.requestId}`,
			);
		}

		try {
			const meshLog = await getLogsByRayId(imsOrgCode, projectId, workspaceId, meshId, rayId);
			if (meshLog) {
				this.log('Event Timestamp : %s', meshLog.eventTimestampMs);
				this.log('Exceptions : %s', meshLog.exceptions);
				this.log('Logs : %s', meshLog.logs);
				this.log('Outcome : %s', meshLog.outcome);
				this.log('Mesh ID : %s', meshLog.meshId);
				this.log('RayId : %s', meshLog.rayId);
				this.log('Mesh URL : %s', meshLog.url);
				this.log('Request Method : %s', meshLog.requestMethod);
				this.log('Request Status : %s', meshLog.responseStatus);
			}
		} catch (error) {
			if (error.message === 'LogNotFound') {
				this.error(
					`No logs found for RayID ${rayId}. Check the RayID and try again. RequestId: ${global.requestId}. Alternatively, you can use the following command to get all logs for a 30 minute time period: \naio api-mesh log-get-bulk --startTime YYYY-MM-DDTHH:MM:SSZ --endTime YYYY-MM-DDTHH:MM:SSZ --filename mesh_logs.csv`,
				);
			} else if (error.message === 'ServerError') {
				this.error(
					`Server error while fetching logs for RayId ${rayId}. Please try again later. RequestId: ${global.requestId}`,
				);
			} else {
				this.error(
					`Unable to get mesh logs. Please check the details and try again. If the error persists please contact support. RequestId: ${global.requestId}`,
				);
			}
		}
	}
}

FetchLogsCommand.description = 'Get the Log of a given mesh by RayId';

module.exports = FetchLogsCommand;
