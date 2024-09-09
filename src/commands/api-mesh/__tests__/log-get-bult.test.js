const fs = require('fs');
const path = require('path');
const GetBulkLogCommand = require('../log-get-bulk');
const { initRequestId, initSdk, promptConfirm } = require('../../../helpers');
const { getMeshId, getPresignedUrls } = require('../../../lib/devConsole');

jest.mock('fs');
jest.mock('axios');
jest.mock('../../../helpers', () => ({
	initSdk: jest.fn().mockResolvedValue({}),
	initRequestId: jest.fn().mockResolvedValue({}),
	promptConfirm: jest.fn().mockResolvedValue(true),
}));
jest.mock('../../../lib/devConsole');
jest.mock('../../../classes/logger');
// const mockIgnoreCacheFlag = Promise.resolve(true);

describe('GetBulkLogCommand', () => {
	let parseSpy;

	beforeEach(() => {
		// Setup spies and mock functions
		// let logSpy = jest.spyOn(GetBulkLogCommand.prototype, 'log');
		// let errorLogSpy = jest.spyOn(GetBulkLogCommand.prototype, 'error');
		parseSpy = jest.spyOn(GetBulkLogCommand.prototype, 'parse').mockResolvedValue({
			flags: {
				startTime: '2024-08-29T12:00:00Z',
				endTime: '2024-08-29T12:30:00Z',
				filename: 'test.csv',
				ignoreCache: false,
			},
		});

		// initRequestId.mockResolvedValue();
		initSdk.mockResolvedValue({
			imsOrgId: 'orgId',
			imsOrgCode: 'orgCode',
			projectId: 'projectId',
			workspaceId: 'workspaceId',
			workspaceName: 'workspaceName',
		});
		getMeshId.mockResolvedValue('meshId');
		getPresignedUrls.mockResolvedValue({
			presignedUrls: [{ key: 'log1.csv', url: 'http://example.com/someHash' }],
			totalSize: 2048,
		});
		promptConfirm.mockResolvedValue(true);
		global.requestId = 'dummy_request_id';
	});

	afterEach(() => {
		jest.clearAllMocks();
	});

	test('throws an error if the time difference between startTime and endTime is greater than 30 minutes', async () => {
		// Mock the file system checks even if they are not the focus of this test
		fs.existsSync.mockReturnValue(true); // Assume the file exists
		fs.statSync.mockReturnValue({ size: 0 }); // Assume the file is empty
		// Set a time difference to more than 30 minutes
		parseSpy.mockResolvedValueOnce({
			flags: {
				startTime: '2024-08-29T12:00:00Z',
				endTime: '2024-08-29T12:45:00Z', // 45 minutes difference
				filename: 'test.csv',
				ignoreCache: false,
			},
		});

		const command = new GetBulkLogCommand([], {});
		await expect(command.run()).rejects.toThrow(
			'Max duration between startTime and endTime should be 30 minutes. Current duration is 0 hours 45 minutes and 0 seconds.',
		);
	});

	test('throws an error if startTime format is invalid', async () => {
		parseSpy.mockResolvedValueOnce({
			flags: {
				startTime: '20240809123456',
				endTime: '2024-08-29T12:30:00Z',
				filename: 'test.csv',
			},
		});

		const command = new GetBulkLogCommand([], {});

		// Assuming your suggestCorrectedDateFormat function corrects the format to "2024-08-09T09:08:33Z"
		const correctedStartTime = '2024-08-09T12:34:56Z'; // Use an appropriate correction

		await expect(command.run()).rejects.toThrow(
			`Use the format YYYY-MM-DDTHH:MM:SSZ for startTime. Did you mean ${correctedStartTime}?`,
		);
	});

	test('throws an error if endTime format is invalid', async () => {
		parseSpy.mockResolvedValueOnce({
			flags: {
				startTime: '2024-08-29T12:00:00Z',
				endTime: '2024-08-29:23:45:56Z',
				filename: 'test.csv',
			},
		});

		const command = new GetBulkLogCommand([], {});

		// Assuming your suggestCorrectedDateFormat function corrects the format to "2024-08-09T09:08:33Z"
		const correctedStartTime = '2024-08-29T23:45:56Z'; // Use an appropriate correction
		await expect(command.run()).rejects.toThrow(
			`Use the format YYYY-MM-DDTHH:MM:SSZ for endTime. Did you mean ${correctedStartTime}?`,
		);
	});

	// Test for totalSize being 0
	test('throws an error if totalSize is 0', async () => {
		// Mock the file system checks even if they are not the focus of this test
		fs.existsSync.mockReturnValue(true); // Assume the file exists
		fs.statSync.mockReturnValue({ size: 0 }); // Assume the file is empty
		// Mock getPresignedUrls to return totalSize as 0
		getPresignedUrls.mockResolvedValueOnce({
			presignedUrls: [{ key: 'log1', url: 'http://example.com/log1' }],
			totalSize: 0, // totalSize is 0
		});

		const command = new GetBulkLogCommand([], {});
		await expect(command.run()).rejects.toThrow('No logs available to download');
	});

	test('throws an error if logs are requested for a date older than 30 days', async () => {
		const today = new Date();
		const thirtyDaysAgo = new Date(today);
		thirtyDaysAgo.setUTCDate(today.getUTCDate() - 30);

		const startTime = new Date(thirtyDaysAgo);
		startTime.setUTCDate(thirtyDaysAgo.getUTCDate() - 1);
		const formattedStartTime = startTime.toISOString().slice(0, 19) + 'Z';

		parseSpy.mockResolvedValueOnce({
			flags: {
				startTime: formattedStartTime,
				endTime: '2024-08-30T12:30:00Z',
				filename: 'test.csv',
			},
		});

		const command = new GetBulkLogCommand([], {});
		await expect(command.run()).rejects.toThrow(
			'Cannot get logs more than 30 days old. Adjust your time range.',
		);
	});

	// Test for file creation and emptiness check
	test('creates file if it does not exist and checks if file is empty before proceeding', async () => {
		fs.existsSync.mockReturnValue(false); // Mock file does not exist
		fs.statSync.mockReturnValue({ size: 0 }); // Mock file is empty

		const mockWriteStream = {
			write: jest.fn(),
			end: jest.fn(),
			on: jest.fn((event, callback) => {
				if (event === 'finish') {
					callback();
				}
			}),
		};
		fs.createWriteStream.mockReturnValue(mockWriteStream);

		const command = new GetBulkLogCommand([], {});
		await command.run();

		expect(fs.existsSync).toHaveBeenCalledWith(path.resolve(process.cwd(), 'test.csv'));
		expect(fs.writeFileSync).toHaveBeenCalledWith(path.resolve(process.cwd(), 'test.csv'), ''); // Ensures file is created if not exists
		expect(mockWriteStream.write).toHaveBeenCalled(); // Writes content to file
	});

	test('throws an error if the file is not empty', async () => {
		fs.existsSync.mockReturnValue(true);
		fs.statSync.mockReturnValue({ size: 1024 });

		const command = new GetBulkLogCommand([], {});
		await expect(command.run()).rejects.toThrow('Make sure the file: test.csv is empty');
	});

	test('downloads logs if all conditions are met', async () => {
		fs.existsSync.mockReturnValue(true);
		fs.statSync.mockReturnValue({ size: 0 });

		const mockWriteStream = {
			write: jest.fn(),
			end: jest.fn(),
			on: jest.fn((event, callback) => {
				if (event === 'finish') {
					callback();
				}
			}),
		};
		fs.createWriteStream.mockReturnValue(mockWriteStream);

		const command = new GetBulkLogCommand([], {});
		await command.run();

		expect(initRequestId).toHaveBeenCalled();
		expect(initSdk).toHaveBeenCalled();
		expect(getMeshId).toHaveBeenCalledWith('orgId', 'projectId', 'workspaceId', 'workspaceName');
		expect(getPresignedUrls).toHaveBeenCalledWith(
			'orgCode',
			'projectId',
			'workspaceId',
			'meshId',
			expect.any(String),
			expect.any(String),
		);
		expect(fs.createWriteStream).toHaveBeenCalledWith(path.resolve(process.cwd(), 'test.csv'), {
			flags: 'a',
		});
		expect(mockWriteStream.write).toHaveBeenCalled();
		expect(mockWriteStream.end).toHaveBeenCalled();
	});
});
