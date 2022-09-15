const webpush = require("web-push")

const vapidKeys = {
  publicKey:
    "BFWDqv8_hdI0BsMtt6AeOGHEcVGHp4DESKRIPjYBfVkzP9ygxPdRw8PoksxEUYVCcn1mEtJqwhnBND559E7AhFc",
  privateKey: "IHYFWFF_AeHIxa6Pr8m3QkAITBSFETiHPxfQOd2dwk0",
};

const pushSubscription = {
    endpoint: "https://fcm.googleapis.com/fcm/send/e8y6b9JMg5Q:APA91bG3MGjj_B65MLWalI3Gnmda-Vj-iZ7umUMZM_rza8FrH3s5pizJBoRYhzL94Hrbb_QNbTwVU8m0pDb17ctKh3-pg7_gam37JE_tjHV4tk9aYbN-t_C_lY5_tJAff_Zu6PZKn8uC",
    expirationTime: null,
    keys: {
        p256dh: "BMh-N6fxVuVQnmrydYQbSYgnU_95lcM8k_DRg156RXWFvxtT7WXLcNRy8zZOIvGLwsGBQogdfVfyHQebpp-DkpA",
        auth: "8iTb8_IS0UwdYixZz8BzUw"
    }
  }

webpush.setVapidDetails(
  "mailto:klicker.support@uzh.ch",
  vapidKeys.publicKey,
  vapidKeys.privateKey
);

const triggerPushMsg = function (pushSubscription, dataToSend) {
  return webpush
    .sendNotification(pushSubscription, dataToSend)
    .catch((err) => {
      if (err.statusCode === 404 || err.statusCode === 410) {
        console.log("Subscription has expired or is no longer valid: ", err);
        // return deleteSubscriptionFromDatabase(subscription._id);
      } else {
        throw err;
      }
    });
};

triggerPushMsg(pushSubscription, JSON.stringify({title: "A new Microlearning is available", message: "Klick now!"}))
