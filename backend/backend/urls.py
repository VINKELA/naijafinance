"""
URL configuration for backend project.

The `urlpatterns` list routes URLs to views. For more information please see:
    https://docs.djangoproject.com/en/6.0/topics/http/urls/
Examples:
Function views
    1. Add an import:  from my_app import views
    2. Add a URL to urlpatterns:  path('', views.home, name='home')
Class-based views
    1. Add an import:  from other_app.views import Home
    2. Add a URL to urlpatterns:  path('', Home.as_view(), name='home')
Including another URLconf
    1. Import the include() function: from django.urls import include, path
    2. Add a URL to urlpatterns:  path('blog/', include('blog.urls'))
"""
from django.contrib import admin
from django.urls import path
from django.urls import path, include

from api.views import request_login_code, verify_login_code, check_email, user_me

urlpatterns = [
    path('api/', include('api.urls')),
    path('auth/request-code/', request_login_code, name='root_request_code'),
    path('auth/verify-code/', verify_login_code, name='root_verify_code'),
    path('auth/check-email/', check_email, name='root_check_email'),
    # Djoser below — OTP paths above to avoid being caught by djoser
    path('auth/', include('djoser.urls')),
    path('auth/', include('djoser.urls.jwt')),
    path('admin/', admin.site.urls),
]



