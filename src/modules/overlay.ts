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
    const mode = props.getProperty('PROCESSING_MODE') || 'label';
    
    // Main status section
    const statusSection = CardService.newCardSection()
      .addWidget(
        CardService.newKeyValue()
          .setTopLabel('MODE')
          .setContent(
            mode === 'send' ? '🚨 Auto-Reply' :
            mode === 'draft' ? '✍️ Create Drafts' :
            '🏷️ Label Only'
          )
      );
    
    // Simple what's happening
    const processSection = CardService.newCardSection()
      .addWidget(
        CardService.newTextParagraph()
          .setText(
            'Will scan emails and apply Support/undefined labels' +
            (mode !== 'label' ? '\n+ ' + (mode === 'draft' ? 'create drafts' : 'send replies') : '')
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
            .setBackgroundColor('#1a73e8')
            .setOnClickAction(
              CardService.newAction()
                .setFunctionName('continueProcessing')
            )
        )
    );
    
    return card.build();
  }
}