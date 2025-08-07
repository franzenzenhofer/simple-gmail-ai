/**
 * Processing Overlay Module
 * Shows immediate feedback when processing starts
 */

namespace ProcessingOverlay {
  export function build(): GoogleAppsScript.Card_Service.Card {
    const card = CardService.newCardBuilder()
      .setHeader(
        CardService.newCardHeader()
          .setTitle('Processing Starting')
      );
    
    // Get current processing stats
    const props = PropertiesService.getUserProperties();
    const mode = props.getProperty(Config.PROP_KEYS.PROCESSING_MODE) || Config.ProcessingMode.LABEL_ONLY;
    
    // Main status section
    const statusSection = CardService.newCardSection()
      .addWidget(
        CardService.newKeyValue()
          .setTopLabel('MODE')
          .setContent(
            mode === Config.ProcessingMode.AUTO_SEND ? '🚨 Auto-Reply' :
            mode === Config.ProcessingMode.CREATE_DRAFTS ? '✍️ Create Drafts' :
            '🏷️ Label Only'
          )
      );
    
    // Simple what's happening
    const processSection = CardService.newCardSection()
      .addWidget(
        CardService.newTextParagraph()
          .setText(
            'Will scan emails and apply labels from your Google Docs configuration' +
            (mode !== Config.ProcessingMode.LABEL_ONLY ? '\n+ ' + 
              (mode === Config.ProcessingMode.CREATE_DRAFTS ? 'create drafts' : 'send replies') : '')
          )
      );
    
    card.addSection(statusSection);
    card.addSection(processSection);
    
    // Continue button
    card.setFixedFooter(
      CardService.newFixedFooter()
        .setPrimaryButton(
          CardService.newTextButton()
            .setText('Start')
            .setBackgroundColor(Config.COLORS.PRIMARY)
            .setOnClickAction(
              CardService.newAction()
                .setFunctionName('continueProcessing')
            )
        )
    );
    
    return card.build();
  }
}