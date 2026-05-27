public with sharing class BAESystemsAIController {
    public BAESystemsAIController() {

    }

    @AuraEnabled(cacheable=false)
    public static String PostChat(string message) {
        try {

            System.debug('User Message:');
        System.debug(message);
            // Call the method
        String token = MicrosoftTokenController.getAccessToken();
         HttpRequest req = new HttpRequest();
        // Use a Named Credential if you have one – see note below.
        // req.setEndpoint('callout:MicrosoftLogin/oauth2/v2.0/token');
        req.setEndpoint('https://apigateway-dev.us.baesystems.com/gateway/SalesforceAIAssist/1.0/api/chat?agent=test');
        req.setMethod('POST');
        req.setHeader('Authorization','Bearer ' + token);
        req.setHeader('Content-Type', 'application/x-www-form-urlencoded');

        // Body must be URL‑encoded key/value pairs
        String jsonBody = '[{"role":"user","contents":[{"$type":"text","text":"hi"}]}]';

        req.setBody(jsonBody);

        // ------------------------------------------------------------
        // 3️⃣  Send the callout
        // ------------------------------------------------------------
        Http http = new Http();
        HTTPResponse resp = http.send(req);

         // ------------------------------------------------------------
        // 4️⃣  Basic validation
        // ------------------------------------------------------------
        if (resp.getStatusCode() != 200) {
            // Throw a user‑friendly exception that LWC can catch.
            String err = 'Token request failed (status=' + resp.getStatusCode() + '): ' + resp.getStatus();
            System.debug(err);
            throw new AuraHandledException(err);
        }

        return (String) resp.getBody();
            
        } catch (Exception e) {
            throw new AuraHandledException('Something went wrong: ' + e.getMessage());
        }
        

    }
}