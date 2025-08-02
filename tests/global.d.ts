declare global {
  namespace NodeJS {
    interface Global {
      CardService: GoogleAppsScript.Card_Service.CardService;
      GmailApp: GoogleAppsScript.Gmail.GmailApp;
      PropertiesService: GoogleAppsScript.Properties.PropertiesService;
      UrlFetchApp: GoogleAppsScript.URL_Fetch.UrlFetchApp;
      console: Console;
    }
  }
}

export {};