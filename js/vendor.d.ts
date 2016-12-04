
interface UserInfo {
  HashID: string;
  Handle: string;
}

declare var gRecentNotesInitial: any;
declare var gNotesUser: UserInfo;
declare var gLoggedUser: UserInfo;
declare var gInitialNote: any;
declare var gNoteUser: UserInfo;

interface Window {
  tryWsReconnect: any;
}
