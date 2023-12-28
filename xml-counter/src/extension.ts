
import * as vscode from 'vscode';
import { posix } from 'path';

let xmlStatusBarItem: vscode.StatusBarItem;

export async function activate() {
	xmlStatusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
	updateXmlStatusBarItem();
	
	// watch xml files and folder which might contain xml files while deleting
	const watcher = vscode.workspace.createFileSystemWatcher('{**/*.xml,**/}');
	watcher.onDidChange(() => updateXmlStatusBarItem());
	watcher.onDidCreate(() => updateXmlStatusBarItem());
	watcher.onDidDelete(() => updateXmlStatusBarItem());
}

export function deactivate() {}

async function updateXmlStatusBarItem () {
	const count = await countXmlFilesInWorkspace();
	xmlStatusBarItem.text = `XML: ${count}`;
	xmlStatusBarItem.show();
}

async function countXmlFilesInWorkspace (): Promise<number> {
	if (!vscode.workspace.workspaceFolders || vscode.workspace.workspaceFolders.length <= 0) {
		return 0;
	}

	const counts = await Promise.all(
		vscode.workspace.workspaceFolders.map((folder: vscode.WorkspaceFolder) => {
			return countXmlFiles(folder.uri, vscode.FileType.Directory);
		})
	);
	const sum = counts.reduce((sum, count) => sum + count, 0);
	return sum;
}

async function countXmlFiles (fileUri: vscode.Uri, fileType: vscode.FileType): Promise<number> {
	if (fileType === vscode.FileType.File) {
		// TODO count only XML files
		return fileUri.path.endsWith('.xml') ? 1 : 0; 
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