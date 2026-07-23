from rest_framework import serializers


class DecisionTreeAnswerSerializer(serializers.Serializer):
    id = serializers.CharField()
    label = serializers.CharField()
    next_node_id = serializers.CharField()
    guidance = serializers.ListField(
        child=serializers.CharField(),
        required=False,
    )


class DecisionTreeLinkSerializer(serializers.Serializer):
    label = serializers.CharField()
    endpoint = serializers.CharField()


class DecisionTreeNodeSerializer(serializers.Serializer):
    id = serializers.CharField()
    type = serializers.ChoiceField(choices=('question', 'outcome'))
    prompt = serializers.CharField(required=False)
    title = serializers.CharField(required=False)
    severity = serializers.ChoiceField(
        choices=('normal', 'emergency'),
        required=False,
    )
    guidance = serializers.ListField(
        child=serializers.CharField(),
        required=False,
    )
    answers = DecisionTreeAnswerSerializer(many=True, required=False)
    links = DecisionTreeLinkSerializer(many=True, required=False)


class FoundCatDecisionTreeSerializer(serializers.Serializer):
    id = serializers.CharField()
    version = serializers.CharField()
    entry_node_id = serializers.CharField()
    safety_notice = serializers.CharField()
    nodes = DecisionTreeNodeSerializer(many=True)
