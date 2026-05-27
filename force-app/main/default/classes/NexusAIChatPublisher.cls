/**
 * Publishes Einstein_Chat_Request__e platform events from the LWC.
 *
 * The LWC calls publishRequest() with the message, mode, history, and a
 * client-generated conversationId. The LWC then listens for
 * Einstein_Chat_Response__e events filtered by that same conversationId via
 * lightning/empApi.
 *
 * The external pub/sub (gRPC) subscriber consumes the request event, runs the
 * LLM / agent orchestration, and publishes the response event back.
 */
public with sharing class NexusAIChatPublisher {

    @TestVisible
    private static final String MODE_CHAT   = 'chat';
    @TestVisible
    private static final String MODE_AGENTS = 'agents';

    /**
     * Publishes a single chat request event.
     *
     * @param conversationId  Client-generated correlation ID (also used as the
     *                        empApi filter on the response channel).
     * @param mode            "chat" or "agents".
     * @param userMessage     The user's message text for this turn.
     * @param historyJson     JSON array string of prior {role, content} turns.
     *                        The current user message is NOT included here;
     *                        the subscriber is expected to append it.
     * @return The EventBus.getOperationId() of the publish, useful for logging.
     */
    @AuraEnabled
    public static String publishRequest(
        String conversationId,
        String mode,
        String userMessage,
        String historyJson
    ) {
        if (String.isBlank(conversationId)) {
            throw new AuraHandledException('conversationId is required');
        }
        if (String.isBlank(userMessage)) {
            throw new AuraHandledException('userMessage is required');
        }
        if (mode != MODE_CHAT && mode != MODE_AGENTS) {
            throw new AuraHandledException('mode must be "chat" or "agents "');
        }

        NexusAI_Chat_Request__e evt = new NexusAI_Chat_Request__e(
            Conversation_Id__c = conversationId,
            Mode__c            = mode,
            User_Message__c    = userMessage,
            History_Json__c    = String.isBlank(historyJson) ? '[]' : historyJson,
            User_Id__c         = UserInfo.getUserId()
        );

        Database.SaveResult sr = EventBus.publish(evt);
        if (!sr.isSuccess()) {
            String firstErr = sr.getErrors().isEmpty()
                ? 'Unknown publish error'
                : sr.getErrors()[0].getMessage();
            throw new AuraHandledException('Failed to publish request: ' + firstErr);
        }
        return EventBus.getOperationId(sr);
    }
}