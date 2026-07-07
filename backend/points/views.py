from django.contrib.auth import get_user_model
from drf_spectacular.utils import OpenApiResponse, extend_schema
from rest_framework.pagination import PageNumberPagination
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle
from rest_framework.views import APIView

from .serializers import LeaderboardEntrySerializer


def set_no_store_headers(response):
    response['Cache-Control'] = 'no-store'
    response['Pragma'] = 'no-cache'
    return response


class LeaderboardPagination(PageNumberPagination):
    page_size = 20
    page_size_query_param = 'page_size'
    max_page_size = 100


class LeaderboardView(APIView):
    authentication_classes = []
    permission_classes = [AllowAny]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = 'points_read'

    def get_queryset(self):
        User = get_user_model()
        return (
            User.objects.filter(
                is_active=True,
                is_email_verified=True,
                contribution_points__gt=0,
            )
            .prefetch_related('earned_badges')
            .order_by('-contribution_points', 'date_joined', 'pk')
        )

    @extend_schema(
        responses={
            200: LeaderboardEntrySerializer(many=True),
            429: OpenApiResponse(description='Leaderboard rate limit exceeded'),
        },
    )
    def get(self, request):
        paginator = LeaderboardPagination()
        page = paginator.paginate_queryset(self.get_queryset(), request, view=self)

        if page is None:
            users = list(self.get_queryset())
            for rank, user in enumerate(users, start=1):
                user.leaderboard_rank = rank
            serializer = LeaderboardEntrySerializer(
                users,
                many=True,
                context={'request': request},
            )
            return set_no_store_headers(Response(serializer.data))

        for rank, user in enumerate(page, start=paginator.page.start_index()):
            user.leaderboard_rank = rank

        serializer = LeaderboardEntrySerializer(
            page,
            many=True,
            context={'request': request},
        )
        return set_no_store_headers(paginator.get_paginated_response(serializer.data))
