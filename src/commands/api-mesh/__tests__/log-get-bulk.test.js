const fs = require('fs');
const path = require('path');
const GetBulkLogCommand = require('../log-get-bulk');
const { initRequestId, initSdk, promptConfirm } = require('../../../helpers');
const { getMeshId, getPresignedUrls } = require('../../../lib/devConsole');
const { suggestCorrectedDateFormat } = require('../../../utils');

jest.mock('fs');
jest.mock('axios');
jest.mock('../../../helpers', () => ({
	initSdk: jest.fn().mockResolvedValue({}),
	initRequestId: jest.fn().mockResolvedValue({}),
	promptConfirm: jest.fn().mockResolvedValue(true),
}));
jest.mock('../../../lib/devConsole');
jest.mock('../../../classes/logger');

describe('GetBulkLogCommand', () => {
	let parseSpy;

	beforeEach(() => {
		// Generate dynamic startTime and endTime
		const now = new Date(); // Get the current date and time
		const startTime = new Date(now);
		const endTime = new Date(now);
		// Set startTime to 29 minutes ago and endTime to now
		startTime.setMinutes(startTime.getMinutes() - 29);
		const formattedStartTime = startTime.toISOString().slice(0, 19) + 'Z'; // Format as YYYY-MM-DDTHH:MM:SSZ
		const formattedEndTime = endTime.toISOString().slice(0, 19) + 'Z';

		// Setup spies and mock functions
		parseSpy = jest.spyOn(GetBulkLogCommand.prototype, 'parse').mockResolvedValue({
			flags: {
				startTime: formattedStartTime,
				endTime: formattedEndTime,
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

		// Get the current date and time
		const now = new Date();

		// Create dynamic startTime and endTime
		const startTime = new Date(now);
		const endTime = new Date(now);
		startTime.setMinutes(startTime.getMinutes() - 45); // Set endTime to 45 minutes after startTime

		const formattedStartTime = startTime.toISOString().slice(0, 19) + 'Z';
		const formattedEndTime = endTime.toISOString().slice(0, 19) + 'Z';

		parseSpy.mockResolvedValueOnce({
			flags: {
				startTime: formattedStartTime,
				endTime: formattedEndTime,
				filename: 'test.csv',
				ignoreCache: false,
			},
		});

		const command = new GetBulkLogCommand([], {});
		await expect(command.run()).rejects.toThrow(
			'Max duration between startTime and endTime should be 30 minutes. Current duration is 0 hours 45 minutes and 0 seconds.',
		);
	});

	test('throws an error if the endTime is greater than current time(now)', async () => {
		// Mock the file system checks even if they are not the focus of this test
		fs.existsSync.mockReturnValue(true); // Assume the file exists
		fs.statSync.mockReturnValue({ size: 0 }); // Assume the file is empty

		// Get the current date and time
		const now = new Date();

		// Create dynamic startTime and endTime
		const startTime = new Date(now);
		const endTime = new Date(now);
		endTime.setMinutes(startTime.getMinutes() + 45); // Set endTime to 45 minutes after startTime

		const formattedStartTime = startTime.toISOString().slice(0, 19) + 'Z';
		const formattedEndTime = endTime.toISOString().slice(0, 19) + 'Z';

		parseSpy.mockResolvedValueOnce({
			flags: {
				startTime: formattedStartTime,
				endTime: formattedEndTime,
				filename: 'test.csv',
				ignoreCache: false,
			},
		});

		const command = new GetBulkLogCommand([], {});
		await expect(command.run()).rejects.toThrow(
			'endTime cannot be in the future. Provide a valid endTime.',
		);
	});

	test('throws an error if startTime format is invalid', async () => {
		parseSpy.mockResolvedValueOnce({
			flags: {
				// startTime: '20240809123456',
				startTime: '20241213223832',
				endTime: '2024-08-29T12:30:00Z',
				filename: 'test.csv',
			},
		});

		const command = new GetBulkLogCommand([], {});

		// Assuming your suggestCorrectedDateFormat function corrects the format to "2024-08-09T09:08:33Z"
		const correctedStartTime = '2024-12-13T22:38:32Z'; // Use an appropriate correction - 2024-08-09T12:34:56Z

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
		expect(getMeshId).toHaveBeenCalledWith('orgCode', 'projectId', 'workspaceId', 'workspaceName');
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
describe('GetBulkLogCommand startTime and endTime validation', () => {
	// Define the test cases as an array of [inputDate, expectedOutput] pairs
	const testCases = [
		// Invalid formats that should be corrected
		['2024-0812T123445', '2024-08-12T12:34:45Z'],
		['2024:08:12-09-08-36Z', '2024-08-12T09:08:36Z'],
		['20241223T234556Z', '2024-12-23T23:45:56Z'],
		['20241213223832', '2024-12-13T22:38:32Z'],
		['2024-12-13T223832Z', '2024-12-13T22:38:32Z'],
		['2024-11-23T21:34:45', '2024-11-23T21:34:45Z'],

		// Invalid date components that should not be corrected, but return null which lets the user know the date is invalid
		['20240834123456Z', null], // Invalid day (34)
		['2024-12-34T23:34:45Z', null], // Invalid day (34)
		['2024-13-23:21:34:45', null], // Invalid month (13)
		['2024-11-63T21:34:45', null], // Invalid day (13) and missing Z
	];

	test.each(testCases)(
		'suggestCorrectedDateFormat("%s") should return "%s"',
		(inputDate, expectedOutput) => {
			const correctedDate = suggestCorrectedDateFormat(inputDate);
			expect(correctedDate).toBe(expectedOutput);
		},
	);
});
