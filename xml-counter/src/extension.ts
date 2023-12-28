
import * as vscode from 'vscode';
import { posix } from 'path';

let myStatusBarItem: vscode.StatusBarItem;

export async function activate() {
	if (!vscode.workspace.workspaceFolders || vscode.workspace.workspaceFolders.length <= 0) {
		return;
	}

	const counts = await Promise.all(
		vscode.workspace.workspaceFolders.map((folder: vscode.WorkspaceFolder) => {
			return countXmlFiles(folder.uri, vscode.FileType.Directory);
		})
	);
	const sum = counts.reduce((sum, count) => sum + count, 0);

	myStatusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
	myStatusBarItem.text = `Test status bar item ${sum}`;
	myStatusBarItem.show();
}

export function deactivate() {}

async function countXmlFiles (fileUri: vscode.Uri, fileType: vscode.FileType): Promise<number> {
	if (fileType === vscode.FileType.File) {
		// TODO count only XML files
		return 1; 
	} else if (fileType === vscode.FileType.Directory) {
		const folderUri = fileUri;
		const folderFiles = await vscode.workspace.fs.readDirectory(folderUri);
		const countsPromises = folderFiles.map(([folderFileName, folderFileType]) => {
			const folderFilePath = posix.join(folderUri.path, folderFileName);
			const folderFileUri = folderUri.with({ path: folderFilePath });
			return countXmlFiles(folderFileUri, folderFileType);
		});
		const counts = await Promise.all(countsPromises);
		const sum = counts.reduce((sum, count) => sum + count, 0);
		return sum;
	} else {
		// Symlinks and other unknown file types
		return 0;
	}
}