from accounts.languages import get_user_preferred_language, normalize_preferred_language


REPORT_STATUS_LABELS = {
    'en': {
        'MISSING': 'Missing',
        'RECENTLY_SEEN': 'Recently seen',
        'FOUND': 'Found',
        'CLOSED': 'Closed',
    },
    'pl': {
        'MISSING': 'Zaginiony',
        'RECENTLY_SEEN': 'Ostatnio widziany',
        'FOUND': 'Znaleziony',
        'CLOSED': 'Zamknięty',
    },
    'nl': {
        'MISSING': 'Vermist',
        'RECENTLY_SEEN': 'Recent gezien',
        'FOUND': 'Gevonden',
        'CLOSED': 'Gesloten',
    },
}

SIGHTING_CONFIDENCE_LABELS = {
    'en': {
        'LOW': 'Low',
        'MEDIUM': 'Medium',
        'HIGH': 'High',
    },
    'pl': {
        'LOW': 'Niska',
        'MEDIUM': 'Średnia',
        'HIGH': 'Wysoka',
    },
    'nl': {
        'LOW': 'Laag',
        'MEDIUM': 'Gemiddeld',
        'HIGH': 'Hoog',
    },
}

NOTIFICATION_EMAIL_TEMPLATES = {
    'en': {
        'report_created': {
            'subject': 'CatSOS report published for {cat_name}',
            'message': (
                'Your lost-cat report for {cat_name} is published on CatSOS.\n\n'
                'Public report link:\n{report_url}\n\n'
                'Share this link or use it on QR posters so helpers can view '
                'the public report and submit accountable sightings.\n\n'
                'For privacy, this confirmation does not include exact address, '
                'chip number, contact phone, or contact email.'
            ),
        },
        'report_status_changed': {
            'subject': 'CatSOS report status changed for {cat_name}',
            'message': (
                'The status for {cat_name} changed from '
                '{old_status_label} to {new_status_label}.\n\n'
                'Public report link:\n{report_url}\n\n'
                'For privacy, this notification does not include exact address, '
                'chip number, contact phone, or contact email.'
            ),
        },
        'sighting_created': {
            'subject': 'New sighting for {cat_name}',
            'message': (
                'A logged-in CatSOS helper submitted a sighting for {cat_name}.\n\n'
                'Seen at: {seen_at_text}\n'
                'Location: {location_summary}\n'
                'Confidence: {confidence_label}\n\n'
                'Review the report and sighting details here:\n{report_url}\n\n'
                'For privacy, this email does not include helper email, phone, '
                'internal user ID, or private notes.'
            ),
        },
    },
    'pl': {
        'report_created': {
            'subject': 'Raport CatSOS dla {cat_name} jest opublikowany',
            'message': (
                'Raport o zaginionym kocie {cat_name} jest opublikowany w CatSOS.\n\n'
                'Link do publicznego raportu:\n{report_url}\n\n'
                'Udostępnij ten link albo użyj go na plakatach QR, aby pomocnicy '
                'mogli zobaczyć publiczny raport i dodać przypisane do konta '
                'obserwacje.\n\n'
                'Ze względu na prywatność to potwierdzenie nie zawiera dokładnego '
                'adresu, numeru chipa, telefonu kontaktowego ani adresu e-mail.'
            ),
        },
        'report_status_changed': {
            'subject': 'Zmieniono status raportu CatSOS dla {cat_name}',
            'message': (
                'Status raportu dla {cat_name} zmienił się z '
                '{old_status_label} na {new_status_label}.\n\n'
                'Link do publicznego raportu:\n{report_url}\n\n'
                'Ze względu na prywatność to powiadomienie nie zawiera dokładnego '
                'adresu, numeru chipa, telefonu kontaktowego ani adresu e-mail.'
            ),
        },
        'sighting_created': {
            'subject': 'Nowa obserwacja kota {cat_name}',
            'message': (
                'Zalogowany pomocnik CatSOS dodał obserwację kota {cat_name}.\n\n'
                'Czas obserwacji: {seen_at_text}\n'
                'Lokalizacja: {location_summary}\n'
                'Pewność: {confidence_label}\n\n'
                'Sprawdź raport i szczegóły obserwacji tutaj:\n{report_url}\n\n'
                'Ze względu na prywatność ta wiadomość nie zawiera adresu e-mail '
                'pomocnika, telefonu, wewnętrznego ID użytkownika ani prywatnych '
                'notatek.'
            ),
        },
    },
    'nl': {
        'report_created': {
            'subject': 'CatSOS-melding gepubliceerd voor {cat_name}',
            'message': (
                'Je vermiste-katmelding voor {cat_name} is gepubliceerd op CatSOS.\n\n'
                'Publieke meldingslink:\n{report_url}\n\n'
                'Deel deze link of gebruik hem op QR-posters zodat helpers de '
                'publieke melding kunnen bekijken en traceerbare waarnemingen '
                'kunnen indienen.\n\n'
                'Voor privacy bevat deze bevestiging geen exact adres, chipnummer, '
                'contacttelefoonnummer of contact-e-mailadres.'
            ),
        },
        'report_status_changed': {
            'subject': 'CatSOS-meldingsstatus gewijzigd voor {cat_name}',
            'message': (
                'De status voor {cat_name} is gewijzigd van '
                '{old_status_label} naar {new_status_label}.\n\n'
                'Publieke meldingslink:\n{report_url}\n\n'
                'Voor privacy bevat deze melding geen exact adres, chipnummer, '
                'contacttelefoonnummer of contact-e-mailadres.'
            ),
        },
        'sighting_created': {
            'subject': 'Nieuwe waarneming voor {cat_name}',
            'message': (
                'Een ingelogde CatSOS-helper heeft een waarneming voor '
                '{cat_name} ingediend.\n\n'
                'Gezien om: {seen_at_text}\n'
                'Locatie: {location_summary}\n'
                'Zekerheid: {confidence_label}\n\n'
                'Bekijk de melding en waarnemingsdetails hier:\n{report_url}\n\n'
                'Voor privacy bevat deze e-mail geen e-mailadres of telefoonnummer '
                'van de helper, interne gebruikers-ID of privénotities.'
            ),
        },
    },
}


def get_report_status_label(status, *, fallback, language) -> str:
    language = normalize_preferred_language(language)
    return REPORT_STATUS_LABELS.get(language, REPORT_STATUS_LABELS['en']).get(
        str(status),
        fallback,
    )


def get_sighting_confidence_label(confidence, *, fallback, language) -> str:
    language = normalize_preferred_language(language)
    return SIGHTING_CONFIDENCE_LABELS.get(language, SIGHTING_CONFIDENCE_LABELS['en']).get(
        str(confidence),
        fallback,
    )


def render_notification_email(template_name, *, user=None, language=None, **context):
    if language is None:
        language = get_user_preferred_language(user)

    language = normalize_preferred_language(language)
    template = NOTIFICATION_EMAIL_TEMPLATES.get(
        language,
        NOTIFICATION_EMAIL_TEMPLATES['en'],
    ).get(template_name)
    if template is None:
        template = NOTIFICATION_EMAIL_TEMPLATES['en'][template_name]

    return (
        template['subject'].format(**context),
        template['message'].format(**context),
    )
