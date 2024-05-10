function disablePaymentButton() {
    var disableButton = $('#paymentButton');
    disableButton.text("Please wait...").prop('disabled', true);
    setTimeout(function() {
        disableButton.prop('disabled', false).text("Continue to payment");
    }, 2000);
}