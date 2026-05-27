@IsTest
public class BAESystemsAIControllerTest {

    // -------------------------------------------------
    // 1️⃣  Mock for a successful HTTP 200 response
    // -------------------------------------------------
    private class MockSuccess implements HttpCalloutMock {
        public HTTPResponse respond(HTTPRequest req) {
            HttpResponse res = new HttpResponse();
            res.setHeader('Content-Type', 'application/json');
            res.setStatusCode(200);
            // Body that the controller will simply return
            res.setBody('{"reply":"ok"}');
            return res;
        }
    }

    // -------------------------------------------------
    // 2️⃣  Mock for a failure (e.g., 400 Bad Request)
    // -------------------------------------------------
    private class MockFailure implements HttpCalloutMock {
        public HTTPResponse respond(HTTPRequest req) {
            HttpResponse res = new HttpResponse();
            res.setHeader('Content-Type', 'application/json');
            res.setStatusCode(400);
            res.setBody('{"error":"bad request"}');
            return res;
        }
    }

    // -------------------------------------------------
    // 3️⃣  Test data setup – tenantId (adjust to your org)
    // -------------------------------------------------
    @TestSetup
    static void setupTenantId() {
        // Example: if tenantId is stored in a Custom Setting called
        //   AI_Config__c with field TenantId__c, insert a record here.
        //   Replace with the actual storage mechanism you use.
        // AI_Config__c cfg = new AI_Config__c(Name = 'Default', TenantId__c = 'dummy-tenant');
        // insert cfg;
    }

    // -------------------------------------------------
    // 4️⃣  Helper to stub the token retrieval
    // -------------------------------------------------
    private static void stubAccessToken() {
        // If MicrosoftTokenController has a test hook, use it.
        // Example implementation in MicrosoftTokenController:
        //   public static String getAccessToken() {
        //       if (Test.isRunningTest()) return 'TEST_TOKEN';
        //       // …real logic…
        //   }
        // No code needed here – just document the requirement.
    }

    // -------------------------------------------------
    // 5️⃣  Success path – should return the body from the mock
    // -------------------------------------------------
    @IsTest
    static void testPostChatSuccess() {
        stubAccessToken();                         // ensure token = 'TEST_TOKEN' in test
        Test.startTest();
        Test.setMock(HttpCalloutMock.class, new MockSuccess());

        String result = BAESystemsAIController.PostChat('message');

        Test.stopTest();

        System.assertEquals('{"reply":"ok"}', result,
            'PostChat should return the exact body of a 200 response');
        System.assertEquals(1, Limits.getCallouts(),
            'Exactly one HTTP callout must have been made');
    }

    // -------------------------------------------------
    // 6️⃣  Failure path – should throw AuraHandledException
    // -------------------------------------------------
    @IsTest
    static void testPostChatFailure() {
        stubAccessToken();                         // ensure token = 'TEST_TOKEN' in test
        Test.startTest();
        Test.setMock(HttpCalloutMock.class, new MockFailure());

        try {
            BAESystemsAIController.PostChat('hi');
            System.assert(false, 'Expected AuraHandledException was not thrown');
        } catch (AuraHandledException ex) {
            System.assert(
                ex.getMessage().contains('Token request failed'),
                'Exception message should indicate a token‑request failure');
        }

        Test.stopTest();

        System.assertEquals(1, Limits.getCallouts(),
            'Exactly one HTTP callout must have been made');
    }
}