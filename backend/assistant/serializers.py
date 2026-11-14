from rest_framework import serializers

from .models import IntakeReport


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


class IntakeReportSerializer(serializers.ModelSerializer):
    cat_name = serializers.CharField(max_length=120, min_length=2, required=False)
    catName = serializers.CharField(max_length=120, min_length=2, required=False, write_only=True)
    reporter_email = serializers.EmailField(required=False)
    reporterEmail = serializers.EmailField(required=False, write_only=True)
    urgency = serializers.ChoiceField(
        choices=IntakeReport.Urgency.choices,
        default=IntakeReport.Urgency.MEDIUM,
    )
    description = serializers.CharField(min_length=10, max_length=500)
    status = serializers.CharField(read_only=True)
    created_at = serializers.DateTimeField(read_only=True)

    class Meta:
        model = IntakeReport
        fields = (
            'id',
            'cat_name',
            'catName',
            'reporter_email',
            'reporterEmail',
            'urgency',
            'description',
            'status',
            'created_at',
        )

    def validate(self, attrs):
        if 'catName' in attrs:
            attrs['cat_name'] = attrs.pop('catName')
        if not attrs.get('cat_name'):
            raise serializers.ValidationError({'cat_name': ['Cat name is required.']})

        if 'reporterEmail' in attrs:
            attrs['reporter_email'] = attrs.pop('reporterEmail')
        if not attrs.get('reporter_email'):
            raise serializers.ValidationError({'reporter_email': ['Reporter email is required.']})

        return attrs

    def to_representation(self, instance):
        data = super().to_representation(instance)
        data['catName'] = instance.cat_name
        data['reporterEmail'] = instance.reporter_email
        return data
