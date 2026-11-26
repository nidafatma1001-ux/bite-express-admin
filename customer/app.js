
function getCustomerLocation() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error("आपके मोबाइल में Location सुविधा उपलब्ध नहीं है।"));
      return;
    }

    navigator.geolocation.getCurrentPosition(
      position => resolve({
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        accuracy: position.coords.accuracy
      }),
      error => {
        if (error.code === 1) {
          reject(new Error(
            "BITE EXPRESS को Location की अनुमति नहीं मिली है।\n\n" +
            "कृपया मोबाइल में Settings → Apps → Chrome → Permissions → Location में जाकर अनुमति दें।\n\n" +
            "फिर BITE EXPRESS में वापस आकर दोबारा Order करें।"
          ));
        } else if (error.code === 2) {
          reject(new Error(
            "मोबाइल की Location नहीं मिल रही। कृपया GPS चालू करके दोबारा कोशिश करें।"
          ));
        } else if (error.code === 3) {
          reject(new Error(
            "Location मिलने में समय लगा। कृपया खुले स्थान पर जाकर दोबारा कोशिश करें।"
          ));
        } else {
          reject(new Error("Location नहीं मिल पाई। कृपया दोबारा कोशिश करें।"));
        }
      },
      {
        enableHighAccuracy: true,
        timeout: 30000,
        maximumAge: 0
      }
    );
  });
}
