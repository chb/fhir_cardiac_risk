//implement JSON.stringify serialization
JSON.stringify = JSON.stringify || function (obj) {
    var t = typeof (obj);
    if (t != "object" || obj === null) {
        // simple data type
        if (t == "string") obj = '"'+obj+'"';
        return String(obj);
    }
    else {
        // recurse array or object
        var n, v, json = [], arr = (obj && obj.constructor == Array);
        for (n in obj) {
            v = obj[n]; t = typeof(v);
            if (t == "string") v = '"'+v+'"';
            else if (t == "object" && v !== null) v = JSON.stringify(v);
            json.push((arr ? "" : '"' + n + '":') + String(v));
        }
        return (arr ? "[" : "{") + String(json) + (arr ? "]" : "}");
    }
};


(function(window){

  if ("" == getParameterByName("personId")) {
    alert("Please include a 'personId' parameter in your request.");
  }
  var urls = {
    base: "http://hl7connect.healthintersections.com.au/svc/fhir",
    lab_feed: "/diagnosticreport/search?subject._id={personId}&_format=json",
    patient: "/patient/@{personId}?_format=json"
  },
  m = JSONSelect.match;

  window.extractData = function() {
    var ret = $.Deferred(),
    lab_feed_url = urls.base + urls.lab_feed,
    patient_url = urls.base + urls.patient,
    labs,
    pt,
    subs = {
      "personId": parseInt(getParameterByName("personId"))
    };

    for (var s in subs) {
      lab_feed_url = lab_feed_url.replace("{"+s+"}", subs[s]);
      patient_url = patient_url.replace("{"+s+"}", subs[s]);
    }

    labs = $.ajax(lab_feed_url, {dataType:'json'});
    pt = $.ajax(patient_url, {dataType:'json'});

    $.when(pt, labs).done(function(patient_result, lab_result){

      var patient = patient_result[0],
      labs = lab_result[0],
      gender = m(':root > :root > :has(.system .value:val("http://hl7.org/fhir/v3/AdministrativeGender"))', patient.Patient.gender)[0].code.value === 'F' ? "female" : "male",
	  dob = (patient.Patient.birthDate ? new XDate(patient.Patient.birthDate.value) : new XDate()), 
      age = Math.floor(dob.diffYears(new XDate())),
      officialName = m(':root > :has(.use .value:val("official"))', patient.Patient.name)[0],
      fname = officialName.family[0].value,
      lname = officialName.given[0].value,

      by_loinc = function(loincs){
        var ret = [];
        $.each(arguments, function(i,l){
          ret = ret.concat(m('.contained > :has(.value:val("'+l+'")) ', labs));
        });
        return ret;
      };

      var hscrp = by_loinc("30522-7");
      var cholesterol = by_loinc("14647-2", "2093-3");
      var hdl = by_loinc("2085-9");

      var missingData = [];
      if (hscrp.length == 0) {
        missingData = missingData.concat(["hs-CRP"]);
      }
      if (cholesterol.length == 0) {
        missingData = missingData.concat(["Cholesterol"]);
      }
      if (hdl.length == 0) {
        missingData = missingData.concat(["HDL"]);
      }
	  if (missingData.length > 0) {
        var missingDataMessage = "No results (";
        var delimiter = "";
        for(var i = 0; i < missingData.length; i++) {
          missingDataMessage += delimiter + missingData[i];
          delimiter = ", ";
        }
        missingDataMessage += ") for " + fname + " " + lname + ".";
        alert(missingDataMessage);
      }

      p = defaultPatient();
      p.birthday = {value:dob};
      p.age = {value:age};
      p.gender={value:gender};
      p.givenName={value:fname};
      p.familyName={value:lname};
      p.hsCRP={value:hscrp_in_mg_per_l(hscrp[0].Observation)};
      p.cholesterol={value:cholesterol_in_mg_per_dl(cholesterol[0].Observation)};
      p.HDL={value:cholesterol_in_mg_per_dl(hdl[0].Observation)};
      p.LDL = {value:p.cholesterol.value-p.HDL.value};

      ret.resolve(p);
    });
    return ret.promise();
  };

  function defaultPatient(){
    return {
      sbp: {value: 120},
      smoker_p: {value: false},
      fx_of_mi_p: {value: false}
    }
  };

  /**
   * Unit conversion formula.
   * See values at http://www.amamanualofstyle.com/page/si-conversion-calculator
   */
  cholesterol_in_mg_per_dl = function(v){
    if (v.valueQuantity.units.value === "mg/dL"){
      return parseFloat(v.valueQuantity.value.value);
    }
    else if (v.valueQuantity.units.value === "mmol/L"){
      return parseFloat(v.valueQuantity.value.value)/ 0.026;
    }
    throw "Unanticipated cholesterol units: " + v.valueQuantity.units;
  };

  /**
   * Unit conversion formula.
   * See values at http://www.amamanualofstyle.com/page/si-conversion-calculator
   */
  hscrp_in_mg_per_l = function(v){
    if (v.valueQuantity.units.value === "mg/L"){
      return parseFloat(v.valueQuantity.value.value);
    }
    else if (v.valueQuantity.units.value === "mmol/L"){
      return parseFloat(v.valueQuantity.value.value)/ 0.10;
    }
    throw "Unanticipated hsCRP units: " + v.valueQuantity.units;
  };


  function getParameterByName(name)
  {
    name = name.replace(/[\[]/, "\\\[").replace(/[\]]/, "\\\]");
    var regexS = "[\\?&]" + name + "=([^&#]*)";
    var regex = new RegExp(regexS);
    var results = regex.exec(window.location.search);
    if(results == null)
      return "";
    else
      return decodeURIComponent(results[1].replace(/\+/g, " "));
  }
})(window);
