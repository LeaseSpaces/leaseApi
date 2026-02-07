import { Request, Response } from "express";

export const usageExamples = (req: Request, res: Response) => {
  res.send(`
    <html>
      <head>
        <title>API Examples</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; padding: 20px; }
          h2 { color: #333; }
          h3 { color: #555; margin-top: 40px; }
          .route { margin-bottom: 20px; padding: 15px; border: 1px solid #ccc; border-radius: 8px; }
          code { background-color: #f4f4f4; padding: 2px 4px; border-radius: 4px; display: block; white-space: pre; }
          .protected { background-color: #fff8e1; }
        </style>
      </head>
      <body>
        <h2>Admin Routes</h2>
        <p>Base URL:<code>https://africa-south1-longo-79a99.cloudfunctions.net/api/api/admin</code></p>

        <div class="route">
          <strong>Admin Login</strong><br/>
          <strong>POST</strong> <code>/admin-login</code><br/>
          <strong>Body:</strong>
          <code>{
  "email": "admin@example.com",
  "password": "plainPassword123"
}</code>
        </div>

        <div class="route">
          <strong>Initialize 2FA</strong><br/>
          <strong>POST</strong> <code>/init-2fa</code><br/>
          <strong>Body:</strong>
          <code>{
  "email": "admin@example.com"
}</code>
        </div>

        <div class="route">
          <strong>Enable 2FA</strong><br/>
          <strong>POST</strong> <code>/enable-2fa</code><br/>
          <strong>Body:</strong>
          <code>{
  "email": "admin@example.com",
  "secret_key": "SECRET_KEY_FROM_QR"
}</code>
        </div>

        <div class="route">
          <strong>Verify OTP</strong><br/>
          <strong>POST</strong> <code>/verify-otp</code><br/>
          <strong>Body:</strong>
          <code>{
  "email": "admin@example.com",
  "token": "123456"
}</code>
        </div>

        <div class="route">
          <strong>Forgot Password</strong><br/>
          <strong>POST</strong> <code>/forgot-password</code><br/>
          <strong>Body:</strong>
          <code>{
  "email": "admin@example.com",
  "newPassword": "newSecurePassword"
}</code>
        </div>

        <div class="route">
          <strong>Get All Admins</strong><br/>
          <strong>GET</strong> <code>/all</code>
        </div>

        <h3>Mobile Routes</h3>
        <p>Base URL:<code>https://africa-south1-longo-79a99.cloudfunctions.net/api/api/mobile</code></p>

        <div class="route">
          <strong>Register User</strong><br/>
          <strong>POST</strong> <code>/register-user</code><br/>
          <strong>Body:</strong>
          <code>{
  "name": "Samketi",
  "surname": "Nkosi",
  "email": "sam@example.com",
  "phoneNumber": "0123456789",
  "userType": 1,
  "password": "securePass123"
}</code>
        </div>

        <div class="route">
          <strong>Register Service Provider (Individual)</strong><br/>
          <strong>POST</strong> <code>/register-service-provider</code><br/>
          <strong>Body:</strong>
          <code>{
  "name": "Samketi Nkosi",
  "email": "sam@gmail.com",
  "role": 1,
  "password": "sam1234",
  "phone": "0734567890",
  "image": "https://example.com/image.jpg",
  "provider_type": "individual",
  "location": {
    "province": "Gauteng",
    "city": "Johannesburg",
    "suburb": "Sandton",
    "address": "123 Main St, Sandton, Johannesburg, Gauteng",
    "service_radius": 10
  },
  "services": ["plumbing", "tutoring"],
  "portfolio": {
    "images": ["https://example.com/image.jpg"],
    "docs": ["https://example.com/doc.pdf"]
  }
}</code>
        </div>

        <div class="route">
          <strong>Register Service Provider (Business)</strong><br/>
          <strong>POST</strong> <code>/register-service-provider-business</code><br/>
          <strong>Body:</strong>
          <code>{
  "name": "Altron",
  "bis_reg_num": "reg number",
  "email": "sam@gmail.com",
  "role": 1,
  "password": "sam1234",
  "phone": "0734567890",
  "image": "https://example.com/image.jpg",
  "provider_type": "business",
  "location": {
    "province": "Gauteng",
    "city": "Johannesburg",
    "suburb": "Sandton",
    "address": "123 Main St, Sandton, Johannesburg, Gauteng",
    "service_radius": 10,
    "other_locations": [
      {
        "province": "Gauteng",
        "city": "Pretoria",
        "suburb": "Hatfield",
        "address": "456 Other Rd, Hatfield, Pretoria"
      },
      {
        "province": "KZN",
        "city": "Durban",
        "suburb": "Umhlanga",
        "address": "789 Marine Dr, Umhlanga, Durban"
      }
    ]
  },
  "services": ["plumbing", "tutoring"],
  "portfolio": {
    "images": ["https://example.com/image1.jpg"],
    "docs": ["https://example.com/doc1.pdf"]
  }
}</code>
        </div>

               <div class="route">
          <strong>User Login</strong><br/>
          <strong>POST</strong> <code>/login</code><br/>
          <strong>Body:</strong>
          <code>{
  "email": "sam@example.com",
  "password": "securePass123"
}</code>
        </div>

        <div class="route protected">
          <strong>Get User Locations <em>(Protected)</em></strong><br/>
          <strong>GET</strong> <code>/user-locations</code><br/>
          <strong>Headers:</strong><br/>
          <code>Authorization: Bearer ey...</code>
        </div>

        <div class="route protected">
          <strong>Update a Location <em>(Protected)</em></strong><br/>
          <strong>PUT</strong> <code>/update-location/:locationId</code><br/>
          <strong>Path Param:</strong> <code>locationId = the document ID of the location</code><br/>
          <strong>Headers:</strong>
          <code>Authorization: Bearer ey...</code>
          <strong>Body:</strong>
          <code>{
  "province": "Gauteng",
  "city": "Pretoria",
  "suburb": "Centurion",
  "address": "123 Changed St",
  "service_radius": 15
}</code>


        </div>

        <div class="route protected">
  <strong>Get All Service Providers <em>(Protected)</em></strong><br/>
  <strong>GET</strong> <code>/all-service-providers</code><br/>
  <strong>Headers:</strong><br/>
  <code>Authorization: Bearer ey...</code>
</div>


<div class="route protected">
<strong>Get Single Service Provider <em>(Protected)</em></strong><br/>
<strong>GET</strong> <code>/service-provider/:id</code><br/>
<strong>Path Param:</strong> <code>id = the user ID of the service provider</code><br/>
<strong>Headers:</strong><br/>
<code>Authorization: Bearer ey...</code>
</div>

<div class="route protected">
<strong>Delete Service Provider <em>(Protected)</em></strong><br/>
<strong>DELETE</strong> <code>/delete-service-providers/:id</code><br/>
<strong>Path Param:</strong> <code>id = the user ID of the service provider</code><br/>
<strong>Headers:</strong><br/>
<code>Authorization: Bearer ey...</code>
</div>

<div class="route protected">
<strong>Update Service Provider Status <em>(Protected)</em></strong><br/>
<strong>PATCH</strong> <code>/update-service-providers/:id</code><br/>
<strong>Path Param:</strong> <code>id = the user ID of the service provider</code><br/>
<strong>Headers:</strong><br/>
<code>Authorization: Bearer ey...</code><br/>
<strong>Body:</strong><br/>
<code>{
"status": "approved"
}</code>
</div>

<div class="route protected">
  <strong>Create an Advertisement <em>(Protected)</em></strong><br/>
  <strong>POST</strong> <code>/create-ad</code><br/>
  <strong>Headers:</strong><br/>
  <code>Authorization: Bearer ey...</code><br/>
  <strong>Body:</strong><br/>
  <code>{
  "title": "Affordable Plumbing Services",
  "owner_id": "user_123",
  "description": "Skilled plumber available in Pretoria.",
  "category": "Plumbing",
  "location": "Pretoria, Gauteng",
  "price": 750.00,
  "images": [
    "https://example.com/image1.jpg",
    "https://example.com/image2.jpg"
  ],
  "documents": [
    "https://example.com/quote.pdf"
  ]
}</code>
</div>

<div class="route">
  <strong>Get All Advertisements</strong><br/>
  <strong>GET</strong> <code>/ads</code>
</div>

<div class="route">
  <strong>Get Single Advertisement</strong><br/>
  <strong>GET</strong> <code>/ads/:adId</code><br/>
  <strong>Path Param:</strong> <code>adId = the document ID of the ad</code>
</div>


<div class="route protected">
  <strong>Update an Advertisement <em>(Protected)</em></strong><br/>
  <strong>PATCH</strong> <code>/ads/:adId</code><br/>
  <strong>Path Param:</strong> <code>adId = the document ID of the ad</code><br/>
  <strong>Headers:</strong><br/>
  <code>Authorization: Bearer ey...</code><br/>
  <strong>Body (partial or full):</strong><br/>
  <code>{
  "title": "Updated Title",
  "price": 800.00,
  "images": ["https://example.com/new-image.jpg"]
}</code>
</div>

<div class="route protected">
  <strong>Delete an Advertisement <em>(Protected)</em></strong><br/>
  <strong>DELETE</strong> <code>/ads/:adId</code><br/>
  <strong>Path Param:</strong> <code>adId = the document ID of the ad</code><br/>
  <strong>Headers:</strong><br/>
  <code>Authorization: Bearer ey...</code>
</div>

<div class="route protected">
  <strong>Create a Bid <em>(Protected)</em></strong><br/>
  <strong>POST</strong> <code>/bids/create</code><br/>
  <strong>Headers:</strong><br/>
  <code>Authorization: Bearer ey...</code><br/>
  <strong>Body:</strong><br/>
  <code>{
  "add_id": "ad_12345",
  "bidder_id": "user_456",
  "bidder_name": "John Doe",
  "amount": 950.00,
  "description": "Offering quick turnaround"
}</code>
</div>

<div class="route protected">
  <strong>Get All Bids <em>(Protected)</em></strong><br/>
  <strong>GET</strong> <code>/bids</code><br/>
  <strong>Headers:</strong><br/>
  <code>Authorization: Bearer ey...</code>
</div>

<div class="route protected">
  <strong>Get a Single Bid <em>(Protected)</em></strong><br/>
  <strong>GET</strong> <code>/bids/:bidId</code><br/>
  <strong>Path Param:</strong> <code>bidId = the document ID of the bid</code><br/>
  <strong>Headers:</strong><br/>
  <code>Authorization: Bearer ey...</code>
</div>


<div class="route protected">
  <strong>Update a Bid <em>(Protected)</em></strong><br/>
  <strong>PATCH</strong> <code>/bids/:bidId</code><br/>
  <strong>Path Param:</strong> <code>bidId = the document ID of the bid</code><br/>
  <strong>Headers:</strong><br/>
  <code>Authorization: Bearer ey...</code><br/>
  <strong>Body (any updatable field):</strong><br/>
  <code>{
  "amount": 1000,
  "description": "Updated offer with faster turnaround"
}</code>
</div>

<div class="route protected">
  <strong>Delete a Bid <em>(Protected)</em></strong><br/>
  <strong>DELETE</strong> <code>/bids/:bidId</code><br/>
  <strong>Path Param:</strong> <code>bidId = the document ID of the bid</code><br/>
  <strong>Headers:</strong><br/>
  <code>Authorization: Bearer ey...</code>
</div>

<div class="route protected">
  <strong>Create Catalogue <em>(Protected)</em></strong><br/>
  <strong>POST</strong> <code>/catalogue/create</code><br/>
  <strong>Headers:</strong><br/>
  <code>Authorization: Bearer ey...</code><br/>
  <strong>Body:</strong><br/>
  <code>{
    "userId": "user123",
    "companyName": "My Company",
    "title": "Service Name",
    "price": "200",
    "status": "Active",
    "description": "Detailed description here",
    "tag": "Optional tag",
    "image": "Optional image URL"
  }</code>
</div>

<div class="route protected">
  <strong>Update Catalogue <em>(Protected)</em></strong><br/>
  <strong>PATCH</strong> <code>/catalogue/update</code><br/>
  <strong>Headers:</strong><br/>
  <code>Authorization: Bearer ey...</code><br/>
  <strong>Body:</strong><br/>
  <code>{
    "catId": "catalogueDocId",
    "title": "New title",
    "price": "300"
  }</code>
</div>

<div class="route protected">
  <strong>Get Catalogue Items <em>(Protected)</em></strong><br/>
  <strong>POST</strong> <code>/catalogue/get</code><br/>
  <strong>Headers:</strong><br/>
  <code>Authorization: Bearer ey...</code><br/>
  <strong>Body:</strong><br/>
  <code>{
    "userId": "user123"
  }</code>
</div>

<div class="route protected">
  <strong>Delete Catalogue Item <em>(Protected)</em></strong><br/>
  <strong>DELETE</strong> <code>/catalogue/delete</code><br/>
  <strong>Headers:</strong><br/>
  <code>Authorization: Bearer ey...</code><br/>
  <strong>Body:</strong><br/>
  <code>{
    "catId": "catalogueDocId"
  }</code>
</div>

<div class="route protected">
  <strong>Create Experience <em>(Protected)</em></strong><br/>
  <strong>POST</strong> <code>/experience/create</code><br/>
  <strong>Headers:</strong><br/>
  <code>Authorization: Bearer ey...</code><br/>
  <strong>Body:</strong><br/>
  <code>{
    "userId": "user123",
    "title": "My Work Experience",
    "description": "This is what I did...",
    "images": ["https://image1.jpg", "https://image2.jpg"]
  }</code>
</div>

<div class="route protected">
  <strong>Update Experience <em>(Protected)</em></strong><br/>
  <strong>PATCH</strong> <code>/experience/update</code><br/>
  <strong>Headers:</strong><br/>
  <code>Authorization: Bearer ey...</code><br/>
  <strong>Body:</strong><br/>
  <code>{
    "expId": "experienceDocId",
    "description": "Updated description",
    "images": ["https://new-image.jpg"]
  }</code>
</div>

<div class="route protected">
  <strong>Get Experiences <em>(Protected)</em></strong><br/>
  <strong>POST</strong> <code>/experience/get</code><br/>
  <strong>Headers:</strong><br/>
  <code>Authorization: Bearer ey...</code><br/>
  <strong>Body:</strong><br/>
  <code>{
    "userId": "user123"
  }</code>
</div>

<div class="route protected">
  <strong>Delete Experience <em>(Protected)</em></strong><br/>
  <strong>DELETE</strong> <code>/experience/delete</code><br/>
  <strong>Headers:</strong><br/>
  <code>Authorization: Bearer ey...</code><br/>
  <strong>Body:</strong><br/>
  <code>{
    "expId": "experienceDocId"
  }</code>
</div>

<div class="route protected">
  <strong>Create Notification <em>(Protected)</em></strong><br/>
  <strong>POST</strong> <code>/notifications/create</code><br/>
  <strong>Headers:</strong><br/>
  <code>Authorization: Bearer ey...</code><br/>
  <strong>Body:</strong><br/>
  <code>{
    "userId": "user123",
    "notificationType": "info",
    "title": "New Update",
    "message": "Something has changed",
    "createdAt": "2025-07-13T10:00:00.000Z"
  }</code>
</div>

<div class="route protected">
  <strong>Update Notification <em>(Protected)</em></strong><br/>
  <strong>PATCH</strong> <code>/notifications/:notificationId</code><br/>
  <strong>Path Param:</strong> <code>notificationId = the document ID of the notification</code><br/>
  <strong>Headers:</strong><br/>
  <code>Authorization: Bearer ey...</code><br/>
  <strong>Body (any updatable field):</strong><br/>
  <code>{
    "title": "Updated title",
    "message": "Updated message"
  }</code>
</div>

<div class="route protected">
  <strong>Delete Notification <em>(Protected)</em></strong><br/>
  <strong>DELETE</strong> <code>/notifications/:notificationId</code><br/>
  <strong>Path Param:</strong> <code>notificationId = the document ID of the notification</code><br/>
  <strong>Headers:</strong><br/>
  <code>Authorization: Bearer ey...</code>
</div>

<div class="route protected">
  <strong>Get Notifications for a User <em>(Protected)</em></strong><br/>
  <strong>GET</strong> <code>/notifications/:userId</code><br/>
  <strong>Path Param:</strong> <code>userId = the ID of the user to fetch notifications for</code><br/>
  <strong>Headers:</strong><br/>
  <code>Authorization: Bearer ey...</code>
</div>

<div class="route protected">
  <strong>Vet Service Provider <em>(Protected)</em></strong><br/>
  <strong>POST</strong> <code>/vet-service-provider/:userId</code><br/>
  <strong>Path Param:</strong> <code>userId = the ID of the service provider to vet</code><br/>
  <strong>Headers:</strong><br/>
  <code>Authorization: Bearer ey...</code><br/>
  <strong>Body:</strong><br/>
  <code>{
    "email": "provider@email.com",
    "status": 1,
    "statusDesign": "Declined",
    "message": "Reason for decline"
  }</code><br/>
  <strong>Note:</strong> Also sends a notification with <code>status</code> included in it.
</div>


<div class="route protected">
  <strong>Get Catalogues by Status <em>(Protected)</em></strong><br/>
  <strong>POST</strong> <code>/catalogues/by-status</code><br/>
  <strong>Headers:</strong><br/>
  <code>Authorization: Bearer ey...</code><br/>
  <strong>Body:</strong><br/>
  <code>{
    "userId": "abc123",
    "status": "active"
  }</code><br/>
  <strong>Response:</strong><br/>
  <code>
    {
      "success": true,
      "data": [
        {
          "id": "catalogue1",
          "userId": "abc123",
          "status": "active",
          ...
        },
        ...
      ]
    }
  </code><br/>
  <strong>Note:</strong> Returns all catalogues belonging to the user where the status matches the one provided.
</div>

<div class="route protected">
  <strong>Get Top 5 Service Providers Leaderboard <em>(Protected)</em></strong><br/>
  <strong>GET</strong> <code>/service-providers/leaderboard</code><br/>
  <strong>Headers:</strong><br/>
  <code>Authorization: Bearer ey...</code><br/>
  <strong>Response:</strong><br/>
  <code>
    {
      "success": true,
      "leaderboard": [
        {
          "id": "user123",
          "name": "Provider Name",
          "points": 1500,
          "rating": 4.9,
          "image": "https://via.placeholder.com/150",
          ...
        },
        ...
      ]
    }
  </code><br/>
  <strong>Note:</strong> Returns the top 5 users sorted by their <code>points</code> field in descending order. This route requires a valid JWT token.
</div>

<div class="route protected">
  <strong>Get All Catalogues <em>(Protected)</em></strong><br/>
  <strong>GET</strong> <code>/catalogues</code><br/>
  <strong>Headers:</strong><br/>
  <code>Authorization: Bearer ey...</code><br/>
  <strong>Response:</strong><br/>
  <code>
    {
      "success": true,
      "data": [
        {
          "id": "catalogue1",
          "userId": "abc123",
          "status": "active",
          ...
        },
        ...
      ]
    }
  </code><br/>
  <strong>Note:</strong> Returns all catalogues in the system. Requires authentication.
</div>

<div class="route protected">
  <strong>Get Nearby Service Providers <em>(Protected)</em></strong><br/>
  <strong>POST</strong> <code>/nearby-providers</code><br/>
  <strong>Headers:</strong><br/>
  <code>Authorization: Bearer ey...</code><br/>
  <strong>Body:</strong><br/>
  <code>
    {
      "lat": -26.2041,
      "lng": 28.0473
    }
  </code><br/>
  <strong>Response:</strong><br/>
  <code>
    {
      "success": true,
      "nearbyProviders": [
        {
          "userId": "abc123",
          "name": "Provider Name",
          "email": "provider@example.com",
          "phone": "0123456789",
          "provider_type": "plumber",
          "location": {
            "address": "123 Main St",
            "suburb": "Sunnyside",
            "city": "Pretoria",
            "province": "Gauteng",
            "latitude": -26.2041,
            "longitude": 28.0473,
            "service_radius": 10
          },
          "distance": "2.45"
        },
        ...
      ]
    }
  </code><br/>
  <strong>Note:</strong> Returns service providers within range of the given coordinates. Requires authentication.
</div>

      </body>
    </html>
  `);
};
