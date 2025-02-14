const { Command } = require('@oclif/core');

const logger = require('../../classes/logger');
const { initSdk, initRequestId } = require('../../helpers');
const { ignoreCacheFlag, fileNameFlag } = require('../../utils');
const { getMeshId, listLogs } = require('../../lib/devConsole');
const { appendFileSync, existsSync } = require('fs');
const { ux } = require('@oclif/core/lib/cli-ux');
const path = require('path');

require('dotenv').config();
class ListLogsCommand extends Command {
	static flags = {
		ignoreCache: ignoreCacheFlag,
		filename: fileNameFlag,
	};

	static enableJsonFlag = true;

	async run() {
		await initRequestId();

		logger.info(`RequestId: ${global.requestId}`);

		const { flags } = await this.parse(ListLogsCommand);

		const { ignoreCache, filename } = await flags;

		if (filename) {
			if (path.extname(filename).toLowerCase() !== '.csv') {
				this.error('Invalid file type. Provide a filename with a .csv extension.');
			}
			const file = path.resolve(process.cwd(), filename);
			if (existsSync(file)) {
				this.error(`File ${filename} already exists. Provide a new file name.`);
			}
		}

		const { imsOrgId, imsOrgCode, projectId, workspaceId, workspaceName } = await initSdk({
			ignoreCache,
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
				const logs = await listLogs(imsOrgCode, projectId, workspaceId, meshId, filename);

				if (logs && logs.length > 0) {
					ux.table(
						logs,
						{
							rayId: {
								header: 'Ray ID',
								minWidth: 15,
							},
							timestamp: {
								header: 'Timestamp',
								minWidth: 15,
							},
							responseStatus: {
								header: 'Response Status',
								minWidth: 15,
							},
							level: {
								header: 'Level',
								minWidth: 15,
							},
						},
						{
							printLine: filename
								? line => appendFileSync(filename, line + '\n')
								: line => this.log(line),
							csv: filename,
							...flags,
						},
					);
					if (filename) {
						this.log(` Successfully downloaded the logs to ${filename}`);
					}
				} else {
					this.log(
						'No recent logs found. Alternatively, you can use the following command to get all logs for a 30 minute time period: \naio api-mesh log-get-bulk --startTime YYYY-MM-DDTHH:MM:SSZ --endTime YYYY-MM-DDTHH:MM:SSZ --filename mesh_logs.csv',
					);
				}
			} catch (error) {
				this.error(`Failed to list recent logs, RequestId: ${global.requestId}`);
			}
		} else {
			this.error(
				`Unable to get mesh config. No mesh found for Org(${imsOrgId}) -> Project(${projectId}) -> Workspace(${workspaceId}). Check the details and try again. RequestId: ${global.requestId}`,
			);
		}
	}
}

ListLogsCommand.description = 'Get recent logs of requests made to the API Mesh.';

module.exports = ListLogsCommand;
