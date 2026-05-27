public with sharing class MicrosoftTokenController {
    public MicrosoftTokenController() {

    }


    @AuraEnabled(cacheable=true)
    public static String getCurrentUserName() {
        // Returns the full name (FirstName + LastName) as stored on the User record
        return [SELECT Name FROM User WHERE Id = :UserInfo.getUserId()].Name;
    }

    @AuraEnabled(cacheable=true)
    public static Map<String, String> getCurrentUserParts() {
        User u = [SELECT FirstName, LastName, Name FROM User WHERE Id = :UserInfo.getUserId()];
        return new Map<String, String>{
            'firstName' => u.FirstName,
            'lastName'  => u.LastName,
            'fullName'  => u.Name
        };
    }

    /**
     * Returns an Azure AD access token for the configured tenant.
     * The method is called from LWC, so it must be @AuraEnabled and non‑cacheable.
     */
    @AuraEnabled(cacheable=false)
    public static String getAccessToken() {
        // ------------------------------------------------------------
        // 1️⃣  Configuration – move these values to Custom Metadata or
        //     Protected Custom Settings for production use.
        // ------------------------------------------------------------
        String tenantId       = '03b86c3a-8954-4d19-9522-e464fe9f22ce';         // e.g. 12345678-90ab-cdef-1234-567890abcdef
        String clientId       = '9331974a-c98b-44a7-a3d3-04815a9a15e2';
        String clientSecret   = '3~T_6Iq6e5fX1d_T._QwzvJdEzwA~8vDnK';
        String scope          = 'https://graph.microsoft.com/.default';
        String grantType      = 'client_credentials';

        // ------------------------------------------------------------
        // 2️⃣  Build the request
        // ------------------------------------------------------------
        HttpRequest req = new HttpRequest();
        // Use a Named Credential if you have one – see note below.
        // req.setEndpoint('callout:MicrosoftLogin/oauth2/v2.0/token');
        req.setEndpoint('https://login.microsoftonline.us/' + tenantId + '/oauth2/v2.0/token');
        req.setMethod('POST');
        req.setHeader('Content-Type', 'application/x-www-form-urlencoded');

        // Body must be URL‑encoded key/value pairs
        String body = EncodingUtil.urlEncode('client_id',   'UTF-8')        + '=' + EncodingUtil.urlEncode(clientId,       'UTF-8') + '&' +
                      EncodingUtil.urlEncode('scope',       'UTF-8')        + '=' + EncodingUtil.urlEncode(scope,          'UTF-8') + '&' +
                      EncodingUtil.urlEncode('client_secret','UTF-8')       + '=' + EncodingUtil.urlEncode(clientSecret,   'UTF-8') + '&' +
                      EncodingUtil.urlEncode('grant_type',  'UTF-8')        + '=' + EncodingUtil.urlEncode(grantType,       'UTF-8');

        req.setBody(body);

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

        // ------------------------------------------------------------
        // 5️⃣  Parse JSON and return the token
        // ------------------------------------------------------------
        // Example response:
        // {
        //   "token_type":"Bearer",
        //   "expires_in":3599,
        //   "ext_expires_in":3599,
        //   "access_token":"eyJ0eXAiOiJKV1QiLCJhbGci..."
        // }
        Map<String, Object> jsonMap = (Map<String, Object>) JSON.deserializeUntyped(resp.getBody());
        if (!jsonMap.containsKey('access_token')) {
            throw new AuraHandledException('Token not present in response');
        }
        System.debug(jsonMap);
        return (String) jsonMap.get('access_token');
    }
}