from rest_framework import serializers

from accounts.serializers import (
    build_profile_picture_url,
    build_public_avatar_fallback,
    build_public_badges,
    build_public_display_name,
)


class LeaderboardEntrySerializer(serializers.Serializer):
    rank = serializers.IntegerField(source='leaderboard_rank', read_only=True)
    id = serializers.IntegerField(read_only=True)
    display_name = serializers.SerializerMethodField()
    profile_picture_url = serializers.SerializerMethodField()
    avatar_fallback = serializers.SerializerMethodField()
    points = serializers.IntegerField(source='contribution_points', read_only=True)
    badges = serializers.SerializerMethodField()

    def get_display_name(self, user) -> str:
        return build_public_display_name(user)

    def get_profile_picture_url(self, user) -> str | None:
        return build_profile_picture_url(
            user,
            request=self.context.get('request'),
        )

    def get_avatar_fallback(self, user) -> str:
        return build_public_avatar_fallback(user)

    def get_badges(self, user) -> list[str]:
        return build_public_badges(user)
