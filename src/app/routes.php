<?php

declare(strict_types=1);

use Psr\Http\Message\ResponseInterface as Response;
use Psr\Http\Message\ServerRequestInterface as Request;
use Slim\App;
use \Firebase\JWT\JWT;

return function (App $app) {
    $container = $app->getContainer();

    $app->get('/public/participants', function (Request $request, Response $response) {
        $query = $request->getQueryParams();

        $key = $_ENV['APP_SECRET'];
        $token = array(
            "iss" => isset($_ENV['AAI_ISSUER']) ? $_ENV['AAI_ISSUER'] : "aai.klicker.uzh.ch",
            "aud" => isset($_ENV['AAI_AUDIENCE']) ? $_ENV['AAI_AUDIENCE'] : "api.klicker.uzh.ch",
            'sub' => $_SERVER['REDIRECT_mail'],
            'scope' => ['PARTICIPANT'],
            'session' => $query->session,
            'aai' => true,
        );

        $jwt = JWT::encode($token, $key);

        // set a cookie with the JWT
        $expires = 0;
        $path = "/graphql";
        $domain = isset($_ENV['COOKIE_DOMAIN']) ? $_ENV['COOKIE_DOMAIN'] : "klicker.uzh.ch";
        $secure = true;
        $httponly = true;
        setcookie("jwt", $jwt, $expires, $path, $domain, $secure, $httponly);

        // redirect the user to the app instead of returning a response
        return $response
            ->withHeader('Location', 'https://app.klicker.uzh.ch/join/' . $query->shortname)
            ->withStatus(302);
    });

    $app->get('/public/', function (Request $request, Response $response) {
        $key = $_ENV['APP_SECRET'];
        $token = array(
            "iss" => isset($_ENV['AAI_ISSUER']) ? $_ENV['AAI_ISSUER'] : "aai.klicker.uzh.ch",
            "aud" => isset($_ENV['AAI_AUDIENCE']) ? $_ENV['AAI_AUDIENCE'] : "api.klicker.uzh.ch",
            'sub' => $_SERVER['REDIRECT_mail'],
            'scope' => ['user'],
            'aai' => true,
            'org' => $_SERVER['REDIRECT_homeOrganization']
            // TODO: embed valid properties in the token
            // "iat" => 1356999524,
            // "nbf" => 1357000000
        );

        // $out = fopen('php://stdout', 'w');
        // fwrite($out, json_encode($_SERVER));

        // throw Error('fail');

        /**
         * IMPORTANT:
         * You must specify supported algorithms for your application. See
         * https://tools.ietf.org/html/draft-ietf-jose-json-web-algorithms-40
         * for a list of spec-compliant algorithms.
         */
        $jwt = JWT::encode($token, $key);

        // set a cookie with the JWT
        $expires = 0;
        $path = "/graphql";
        $domain = isset($_ENV['COOKIE_DOMAIN']) ? $_ENV['COOKIE_DOMAIN'] : "klicker.uzh.ch";
        $secure = true;
        $httponly = true;
        setcookie("jwt", $jwt, $expires, $path, $domain, $secure, $httponly);

        // redirect the user to the app instead of returning a response
        return $response
            ->withHeader('Location', isset($_ENV['REDIRECT_LOCATION']) ? $_ENV['REDIRECT_LOCATION'] : 'https://app.klicker.uzh.ch/entrypoint')
            ->withStatus(302);
    });
};
