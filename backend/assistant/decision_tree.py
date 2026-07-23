FOUND_CAT_DECISION_TREE = {
    'id': 'found-cat',
    'version': '2026-07-23',
    'entry_node_id': 'injury',
    'safety_notice': (
        'This assistant gives general safety steps only. It does not provide '
        'veterinary diagnosis and does not replace a veterinarian, shelter, '
        'or emergency service.'
    ),
    'nodes': [
        # -------------------------------------------------------------------
        # Existing question nodes
        # -------------------------------------------------------------------
        {
            'id': 'injury',
            'type': 'question',
            'prompt': 'Does the cat appear injured, trapped, or in immediate danger?',
            'answers': [
                {
                    'id': 'yes',
                    'label': 'Yes',
                    'next_node_id': 'emergency_severity',
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
                    'next_node_id': 'collar_with_tag',
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
                    'next_node_id': 'microchip_scan_advice',
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
                    'next_node_id': 'friendly_cat_care',
                    'guidance': [
                        'Avoid chasing. Offer space, water, and a quiet safe area if available.',
                    ],
                },
                {
                    'id': 'scared',
                    'label': 'Scared or hiding',
                    'next_node_id': 'afraid_feral_cat',
                    'guidance': [
                        'Do not chase. Watch from a distance and record the location.',
                    ],
                },
                {
                    'id': 'defensive',
                    'label': 'Defensive or aggressive',
                    'next_node_id': 'afraid_feral_cat',
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
        # -------------------------------------------------------------------
        # CAT-075: Emergency branch for injured/sick cats
        # -------------------------------------------------------------------
        {
            'id': 'emergency_severity',
            'type': 'question',
            'prompt': 'What best describes the situation?',
            'answers': [
                {
                    'id': 'bleeding_or_hit',
                    'label': 'Bleeding, hit by car, or visibly broken limb',
                    'next_node_id': 'urgent_help',
                    'guidance': [
                        'Do not move the cat unless it is in immediate danger of further harm.',
                        'Keep the cat warm with a towel or jacket placed gently over it.',
                    ],
                },
                {
                    'id': 'trapped',
                    'label': 'Trapped or stuck (tree, fence, drain)',
                    'next_node_id': 'emergency_trapped',
                },
                {
                    'id': 'sick_lethargic',
                    'label': 'Sick, lethargic, or not moving',
                    'next_node_id': 'emergency_sick',
                },
                {
                    'id': 'other_danger',
                    'label': 'Other immediate danger',
                    'next_node_id': 'urgent_help',
                },
            ],
        },
        {
            'id': 'emergency_trapped',
            'type': 'outcome',
            'title': 'Help a trapped cat safely',
            'severity': 'emergency',
            'guidance': [
                'Do not force the cat out — this can cause injury.',
                'Call local animal rescue or fire services for trapped animals.',
                'Keep the area calm and quiet while waiting for help.',
                'Note the exact location and share it with responders.',
            ],
            'links': [
                {'label': 'Find nearby help', 'endpoint': '/api/maps/nearby-help/'},
            ],
        },
        {
            'id': 'emergency_sick',
            'type': 'outcome',
            'title': 'Care for a sick or lethargic cat',
            'severity': 'emergency',
            'guidance': [
                'Do not attempt treatment or diagnosis.',
                'Do not give the cat any medication.',
                'Keep the cat warm and sheltered from wind and rain.',
                'Offer a small amount of water but do not force the cat to drink.',
                'Contact the nearest veterinarian or emergency animal clinic.',
                'Transport gently in a secure carrier or box if you must move the cat.',
            ],
            'links': [
                {'label': 'Find nearby help', 'endpoint': '/api/maps/nearby-help/'},
            ],
        },
        # -------------------------------------------------------------------
        # Existing emergency outcome (kept intact, severity preserved)
        # -------------------------------------------------------------------
        {
            'id': 'urgent_help',
            'type': 'outcome',
            'title': 'Prioritize urgent help',
            'severity': 'emergency',
            'guidance': [
                'Do not attempt treatment or diagnosis.',
                'Do not move an injured cat unless it is in immediate further danger.',
                'Keep the cat warm with a towel or jacket if possible.',
                'Contact a veterinarian, shelter, or local emergency service.',
                'Share the exact location, visible condition, and safe access details.',
            ],
            'links': [
                {'label': 'Find nearby help', 'endpoint': '/api/maps/nearby-help/'},
            ],
        },
        # -------------------------------------------------------------------
        # CAT-076: Collar with tag branch
        # -------------------------------------------------------------------
        {
            'id': 'collar_with_tag',
            'type': 'outcome',
            'title': 'Use the collar tag information',
            'severity': 'normal',
            'guidance': [
                'Read the tag carefully — look for a name, phone number, or address.',
                'Call the number on the tag if one is visible.',
                'If the tag has a registration number, contact the issuing registry.',
                'The cat may also be microchipped — consider a vet scan as a backup.',
                'Do not remove the collar from the cat.',
                'Take a photo of the tag for your records.',
            ],
        },
        # -------------------------------------------------------------------
        # CAT-076: Microchip scan advice branch
        # -------------------------------------------------------------------
        {
            'id': 'microchip_scan_advice',
            'type': 'outcome',
            'title': 'Visit a vet for a microchip scan',
            'severity': 'normal',
            'guidance': [
                'Most vets and shelters will scan for a microchip free of charge.',
                'A microchip can identify the registered owner quickly.',
                'You do not need to be the owner to request a scan.',
                'If the cat is too scared to transport, ask about mobile scanning options.',
                'While waiting, keep the cat safe and offer water.',
            ],
            'links': [
                {'label': 'Find nearby help', 'endpoint': '/api/maps/nearby-help/'},
            ],
        },
        # -------------------------------------------------------------------
        # CAT-076: Friendly cat care branch
        # -------------------------------------------------------------------
        {
            'id': 'friendly_cat_care',
            'type': 'question',
            'prompt': 'Can you provide temporary shelter for the cat?',
            'answers': [
                {
                    'id': 'can_shelter',
                    'label': 'Yes, I can keep it safe temporarily',
                    'next_node_id': 'friendly_cat_shelter',
                },
                {
                    'id': 'cannot_shelter',
                    'label': 'No, I cannot take it in',
                    'next_node_id': 'location',
                    'guidance': [
                        'Offer water and food if possible, then document the location.',
                    ],
                },
            ],
        },
        {
            'id': 'friendly_cat_shelter',
            'type': 'outcome',
            'title': 'Provide temporary shelter for a friendly cat',
            'severity': 'normal',
            'guidance': [
                'Keep the cat in a quiet, enclosed room away from other pets.',
                'Provide fresh water, food, and a litter tray.',
                'Do not let the cat outside — it may wander off again.',
                'Check local lost-cat reports and submit a sighting.',
                'Visit a vet to scan for a microchip as soon as possible.',
                'Post on local community groups that you found a cat (do not share your exact address).',
            ],
            'links': [
                {'label': 'Find nearby help', 'endpoint': '/api/maps/nearby-help/'},
            ],
        },
        # -------------------------------------------------------------------
        # CAT-076: Afraid / feral cat branch
        # -------------------------------------------------------------------
        {
            'id': 'afraid_feral_cat',
            'type': 'question',
            'prompt': 'Does the cat appear to be feral (wild) or just frightened?',
            'answers': [
                {
                    'id': 'likely_feral',
                    'label': 'Likely feral — ear-tipped or very wild',
                    'next_node_id': 'feral_cat_advice',
                },
                {
                    'id': 'likely_lost',
                    'label': 'Likely lost — just scared',
                    'next_node_id': 'scared_lost_cat_advice',
                },
                {
                    'id': 'not_sure',
                    'label': 'Not sure',
                    'next_node_id': 'scared_lost_cat_advice',
                },
            ],
        },
        {
            'id': 'feral_cat_advice',
            'type': 'outcome',
            'title': 'How to help a feral cat',
            'severity': 'normal',
            'guidance': [
                'Do not chase or attempt to catch a feral cat.',
                'Leave food and fresh water at a safe distance.',
                'Observe from afar and note the location.',
                'Contact a local TNR (trap-neuter-return) group if the cat is unmanaged.',
                'An ear-tipped cat has likely already been neutered and returned.',
                'Do not relocate feral cats without professional guidance.',
            ],
        },
        {
            'id': 'scared_lost_cat_advice',
            'type': 'outcome',
            'title': 'How to help a scared but possibly lost cat',
            'severity': 'normal',
            'guidance': [
                'Do not chase — sit quietly and let the cat approach on its own terms.',
                'Leave food and water nearby and observe from a distance.',
                'Return to the same spot regularly — lost cats often stay in one area.',
                'Record the location, time, and any distinguishing features.',
                'Check local lost-cat reports and submit a sighting if there is a match.',
                'If the cat eventually approaches, consider a vet visit for a microchip scan.',
            ],
            'links': [
                {'label': 'Find nearby help', 'endpoint': '/api/maps/nearby-help/'},
            ],
        },
        # -------------------------------------------------------------------
        # Existing outcome nodes (kept intact)
        # -------------------------------------------------------------------
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
