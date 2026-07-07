FOUND_CAT_DECISION_TREE = {
    'id': 'found-cat',
    'version': '2026-07-07',
    'entry_node_id': 'injury',
    'safety_notice': (
        'This assistant gives general safety steps only. It does not provide '
        'veterinary diagnosis and does not replace a veterinarian, shelter, '
        'or emergency service.'
    ),
    'nodes': [
        {
            'id': 'injury',
            'type': 'question',
            'prompt': 'Does the cat appear injured, trapped, or in immediate danger?',
            'answers': [
                {
                    'id': 'yes',
                    'label': 'Yes',
                    'next_node_id': 'urgent_help',
                    'guidance': [
                        'Keep your distance if moving the cat could make things worse.',
                        'Contact a veterinarian, shelter, or local emergency service.',
                    ],
                },
                {
                    'id': 'no',
                    'label': 'No',
                    'next_node_id': 'collar',
                },
                {
                    'id': 'unsure',
                    'label': 'Not sure',
                    'next_node_id': 'collar',
                    'guidance': [
                        'If the cat is in traffic, trapped, or declining quickly, treat it as urgent.',
                    ],
                },
            ],
        },
        {
            'id': 'collar',
            'type': 'question',
            'prompt': 'Can you see a collar or visible ID tag?',
            'answers': [
                {
                    'id': 'visible_contact',
                    'label': 'Yes, contact details are visible',
                    'next_node_id': 'microchip',
                    'guidance': [
                        'Use the visible contact details if you can do so safely.',
                    ],
                },
                {
                    'id': 'collar_no_contact',
                    'label': 'Collar only',
                    'next_node_id': 'microchip',
                },
                {
                    'id': 'no_collar',
                    'label': 'No collar',
                    'next_node_id': 'microchip',
                },
            ],
        },
        {
            'id': 'microchip',
            'type': 'question',
            'prompt': 'Has a vet, shelter, or scanner checked for a microchip?',
            'answers': [
                {
                    'id': 'chip_found',
                    'label': 'Yes, chip found',
                    'next_node_id': 'microchip_owner_help',
                },
                {
                    'id': 'not_checked',
                    'label': 'Not checked yet',
                    'next_node_id': 'friendliness',
                    'guidance': [
                        'A vet or shelter can usually scan a microchip without ownership details being public.',
                    ],
                },
                {
                    'id': 'no_chip',
                    'label': 'Checked, no chip found',
                    'next_node_id': 'friendliness',
                },
            ],
        },
        {
            'id': 'friendliness',
            'type': 'question',
            'prompt': 'How does the cat behave when approached calmly?',
            'answers': [
                {
                    'id': 'friendly',
                    'label': 'Friendly or approachable',
                    'next_node_id': 'location',
                    'guidance': [
                        'Avoid chasing. Offer space, water, and a quiet safe area if available.',
                    ],
                },
                {
                    'id': 'scared',
                    'label': 'Scared or hiding',
                    'next_node_id': 'location',
                    'guidance': [
                        'Do not chase. Watch from a distance and record the location.',
                    ],
                },
                {
                    'id': 'defensive',
                    'label': 'Defensive or aggressive',
                    'next_node_id': 'location',
                    'guidance': [
                        'Keep distance and ask local animal services or a shelter for help.',
                    ],
                },
            ],
        },
        {
            'id': 'location',
            'type': 'question',
            'prompt': 'Is the cat still at the same location?',
            'answers': [
                {
                    'id': 'still_there',
                    'label': 'Yes',
                    'next_node_id': 'document_and_report',
                },
                {
                    'id': 'moved',
                    'label': 'No, it moved away',
                    'next_node_id': 'last_seen_report',
                },
                {
                    'id': 'unknown',
                    'label': 'I am not sure',
                    'next_node_id': 'last_seen_report',
                },
            ],
        },
        {
            'id': 'urgent_help',
            'type': 'outcome',
            'title': 'Prioritize urgent help',
            'severity': 'emergency',
            'guidance': [
                'Do not attempt treatment or diagnosis.',
                'Contact a veterinarian, shelter, or local emergency service.',
                'Share the exact location, visible condition, and safe access details.',
            ],
        },
        {
            'id': 'microchip_owner_help',
            'type': 'outcome',
            'title': 'Follow the microchip contact process',
            'severity': 'normal',
            'guidance': [
                'Let the vet, shelter, or scanner contact the registered owner.',
                'Do not publish chip numbers or owner details publicly.',
                'If asked, share where and when the cat was found.',
            ],
        },
        {
            'id': 'document_and_report',
            'type': 'outcome',
            'title': 'Document and report safely',
            'severity': 'normal',
            'guidance': [
                'Take a photo only if it is safe and does not stress the cat.',
                'Record the public location and time.',
                'Check local lost-cat reports and submit a sighting if there is a match.',
            ],
        },
        {
            'id': 'last_seen_report',
            'type': 'outcome',
            'title': 'Share last-seen information',
            'severity': 'normal',
            'guidance': [
                'Record the last known location, direction of travel, and time.',
                'Avoid posting private home addresses publicly.',
                'Submit a sighting to a matching lost-cat report if possible.',
            ],
        },
    ],
}
