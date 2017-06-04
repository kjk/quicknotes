interface UserInfo {
  HashID: string;
  Handle: string;
}

declare var gNotesUser: UserInfo;
declare var gLoggedUser: UserInfo;
declare var gInitialNote: any;
declare var gNoteUser: UserInfo;
declare var gIsDebug: boolean;

interface Window {
  tryWsReconnect: any;
}
